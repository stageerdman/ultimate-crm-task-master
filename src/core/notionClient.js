// requires: App.core (namespace), App.core.log, App.core.httpClient
'use strict';
App.core.notionClient = (function () {
  var http = App.core.httpClient;

  // Property names as they actually exist in the owner's live Notion workspace (see the current OPEN
  // update's STATUS.md "Live Notion verification" entry) — this is a personal single-workspace tool, the
  // schema is a settled project decision, not something meant to be end-user-configurable per property.
  var CONTACT_PROPS = {
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    urlContact: 'URL Contact',
    urlOpportunity: 'URL Opportunity',
  };
  var TASK_PROPS = {
    title: 'Task',
    contact: 'People',
    due: 'Due Date',
    status: 'Status',
    note: 'Note',
    stage: 'Stage',
    day: 'Day',
    call: 'Call',
    total: 'Total',
    modifier: 'Modifier',
  };

  var contactsDatabaseId = null;
  var tasksDatabaseId = null;
  // Resolved lazily and cached — a database's data_source_id doesn't change once resolved (Notion API
  // version 2025-09-03 split databases into data sources; queries/schema calls target the data source,
  // not the database, see ROADMAP.md Step 1).
  var dataSourceIdCache = {};

  function configure(options) {
    http.configure(options.apiKey);
    contactsDatabaseId = options.contactsDatabaseId;
    tasksDatabaseId = options.tasksDatabaseId;
    dataSourceIdCache = {};
  }

  function resolveDataSourceId(databaseId) {
    if (dataSourceIdCache[databaseId]) {
      return Promise.resolve(dataSourceIdCache[databaseId]);
    }
    return http.request('GET', '/databases/' + databaseId).then(function (database) {
      var dataSources = database && database.data_sources;
      if (!dataSources || !dataSources.length) {
        throw new Error('App.core.notionClient: database ' + databaseId + ' has no data sources');
      }
      dataSourceIdCache[databaseId] = dataSources[0].id;
      return dataSourceIdCache[databaseId];
    });
  }

  function contactsDataSourceId() {
    return resolveDataSourceId(contactsDatabaseId);
  }

  function tasksDataSourceId() {
    return resolveDataSourceId(tasksDatabaseId);
  }

  // Collects every page across a paginated query. Single-user data volumes are expected to fit in one
  // page almost always, but the cursor loop runs regardless for correctness (ROADMAP.md Step 1).
  function queryAllPages(dataSourceId, body) {
    var results = [];
    function fetchPage(cursor) {
      var pageBody = Object.assign({}, body, { page_size: 100 });
      if (cursor) pageBody.start_cursor = cursor;
      return http.request('POST', '/data_sources/' + dataSourceId + '/query', pageBody).then(function (response) {
        results = results.concat(response.results);
        if (response.has_more) return fetchPage(response.next_cursor);
        return results;
      });
    }
    return fetchPage(null);
  }

  function titleValue(text) {
    return { title: [{ text: { content: text } }] };
  }

  function richTextValue(text) {
    return { rich_text: [{ text: { content: text } }] };
  }

  // Builds a Notion page-properties object from a plain {logicalField: value} state object, skipping
  // any field whose value is undefined so partial updates (PATCH) never clobber properties the caller
  // didn't intend to touch.
  function buildContactProperties(fields) {
    var properties = {};
    if (fields.name !== undefined) properties[CONTACT_PROPS.name] = titleValue(fields.name);
    if (fields.phone !== undefined) properties[CONTACT_PROPS.phone] = { phone_number: fields.phone };
    if (fields.email !== undefined) properties[CONTACT_PROPS.email] = { email: fields.email };
    if (fields.urlContact !== undefined) properties[CONTACT_PROPS.urlContact] = { url: fields.urlContact };
    if (fields.urlOpportunity !== undefined) properties[CONTACT_PROPS.urlOpportunity] = { url: fields.urlOpportunity };
    return properties;
  }

  function buildTaskProperties(fields) {
    var properties = {};
    if (fields.title !== undefined) properties[TASK_PROPS.title] = titleValue(fields.title);
    if (fields.contactId !== undefined) properties[TASK_PROPS.contact] = { relation: [{ id: fields.contactId }] };
    if (fields.due !== undefined) properties[TASK_PROPS.due] = { date: fields.due ? { start: fields.due } : null };
    if (fields.status !== undefined) properties[TASK_PROPS.status] = { status: fields.status ? { name: fields.status } : null };
    if (fields.note !== undefined) properties[TASK_PROPS.note] = richTextValue(fields.note || '');
    if (fields.stage !== undefined) properties[TASK_PROPS.stage] = { select: fields.stage ? { name: fields.stage } : null };
    if (fields.day !== undefined) properties[TASK_PROPS.day] = { number: fields.day };
    if (fields.call !== undefined) properties[TASK_PROPS.call] = { number: fields.call };
    if (fields.total !== undefined) properties[TASK_PROPS.total] = { number: fields.total };
    if (fields.modifier !== undefined) properties[TASK_PROPS.modifier] = richTextValue(fields.modifier || '');
    return properties;
  }

  function createContact(fields) {
    return contactsDataSourceId().then(function (dataSourceId) {
      return http.request('POST', '/pages', {
        parent: { data_source_id: dataSourceId },
        properties: buildContactProperties(fields),
      });
    });
  }

  function updateContact(pageId, fields) {
    return http.request('PATCH', '/pages/' + pageId, { properties: buildContactProperties(fields) });
  }

  function getContact(pageId) {
    return http.request('GET', '/pages/' + pageId);
  }

  // Single compound `or` filter across every provided identifying field — one query, no client-side
  // merge needed (confirmed live, see STATUS.md). Callers pass only the fields they actually extracted;
  // an empty/undefined field is left out of the filter rather than matched against an empty string.
  function findContact(criteria) {
    var leaves = [];
    if (criteria.phone) leaves.push({ property: CONTACT_PROPS.phone, phone_number: { equals: criteria.phone } });
    if (criteria.email) leaves.push({ property: CONTACT_PROPS.email, email: { equals: criteria.email } });
    if (criteria.url) {
      leaves.push({ property: CONTACT_PROPS.urlContact, url: { equals: criteria.url } });
      leaves.push({ property: CONTACT_PROPS.urlOpportunity, url: { equals: criteria.url } });
    }
    if (!leaves.length) return Promise.resolve([]);
    return contactsDataSourceId().then(function (dataSourceId) {
      return queryAllPages(dataSourceId, { filter: { or: leaves } });
    });
  }

  function createTask(fields) {
    return tasksDataSourceId().then(function (dataSourceId) {
      return http.request('POST', '/pages', {
        parent: { data_source_id: dataSourceId },
        properties: buildTaskProperties(fields),
      });
    });
  }

  function updateTask(pageId, fields) {
    return http.request('PATCH', '/pages/' + pageId, { properties: buildTaskProperties(fields) });
  }

  function deleteTask(pageId) {
    return http.request('PATCH', '/pages/' + pageId, { in_trash: true });
  }

  function listTasksForContact(contactId) {
    return tasksDataSourceId().then(function (dataSourceId) {
      return queryAllPages(dataSourceId, {
        filter: { property: TASK_PROPS.contact, relation: { contains: contactId } },
        sorts: [{ property: TASK_PROPS.due, direction: 'ascending' }],
      });
    });
  }

  // Full-screen views filter/sort client-side over this complete list (App.tasks.taskViews), the same
  // way the predecessor's taskStore polled everything and filtered in JS — see ROADMAP.md Step 3.
  function listAllTasks() {
    return tasksDataSourceId().then(function (dataSourceId) {
      return queryAllPages(dataSourceId, {
        sorts: [{ property: TASK_PROPS.due, direction: 'ascending' }],
      });
    });
  }

  function firstRichText(prop) {
    return prop && prop.rich_text && prop.rich_text[0] ? prop.rich_text[0].plain_text : '';
  }

  function firstTitleText(prop) {
    return prop && prop.title && prop.title[0] ? prop.title[0].plain_text : '';
  }

  // Raw Notion task page -> a plain JS object every UI module reads/writes against, so property-shape
  // knowledge (rich_text[0].plain_text, select.name, etc.) lives in exactly one place. Unlike the
  // predecessor's titleEncoder.decode, this is the only decode step — there is no corresponding "encode
  // into one field," every field here is its own real Notion property.
  function decorateTask(page) {
    var props = page.properties;
    var dueDate = props[TASK_PROPS.due] && props[TASK_PROPS.due].date;
    return {
      id: page.id,
      contactId: props[TASK_PROPS.contact].relation[0] ? props[TASK_PROPS.contact].relation[0].id : null,
      title: firstTitleText(props[TASK_PROPS.title]),
      due: dueDate ? new Date(dueDate.start) : null,
      status: props[TASK_PROPS.status].status ? props[TASK_PROPS.status].status.name : null,
      stage: props[TASK_PROPS.stage].select ? props[TASK_PROPS.stage].select.name : null,
      day: props[TASK_PROPS.day].number,
      call: props[TASK_PROPS.call].number,
      total: props[TASK_PROPS.total].number,
      note: firstRichText(props[TASK_PROPS.note]),
      modifier: firstRichText(props[TASK_PROPS.modifier]),
      // Real Notion page metadata — no GHL-style "which field name is 'last updated'" guessing needed.
      lastEditedTime: page.last_edited_time ? new Date(page.last_edited_time) : null,
      createdTime: page.created_time ? new Date(page.created_time) : null,
    };
  }

  function decorateContact(page) {
    var props = page.properties;
    return {
      id: page.id,
      name: firstTitleText(props[CONTACT_PROPS.name]),
      phone: props[CONTACT_PROPS.phone] ? props[CONTACT_PROPS.phone].phone_number : null,
      email: props[CONTACT_PROPS.email] ? props[CONTACT_PROPS.email].email : null,
      urlContact: props[CONTACT_PROPS.urlContact] ? props[CONTACT_PROPS.urlContact].url : null,
      urlOpportunity: props[CONTACT_PROPS.urlOpportunity] ? props[CONTACT_PROPS.urlOpportunity].url : null,
    };
  }

  return {
    configure: configure,
    CONTACT_PROPS: CONTACT_PROPS,
    TASK_PROPS: TASK_PROPS,
    createContact: createContact,
    updateContact: updateContact,
    getContact: getContact,
    findContact: findContact,
    createTask: createTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    listTasksForContact: listTasksForContact,
    listAllTasks: listAllTasks,
    decorateTask: decorateTask,
    decorateContact: decorateContact,
  };
})();
