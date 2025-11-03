// Verifies selected HTTP handlers by capturing the callback registered with daveappserver.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const feedlanddatabase = require("feedlanddatabase");
const daveappserver = require("daveappserver");
const davesql = require("davesql");
const daveutils = require("daveutils");

function stubSqlEncoding () {
	const originalEncode = davesql.encode;
	const originalEncodeValues = davesql.encodeValues;

	davesql.encode = function (val) {
		if (val === undefined || val === null) {
			return "NULL";
		}
		if (val instanceof Date) {
			return `'${val.toISOString ()}'`;
		}
		const str = String (val).replace(/'/g, "''");
		return `'${str}'`;
	};

	davesql.encodeValues = function (obj) {
		const keys = Object.keys (obj);
		const cols = keys.join (", ");
		const values = keys.map ((key) => this.encode (obj [key])).join (", ");
		return `(${cols}) values (${values})`;
	};

	return function restore () {
		davesql.encode = originalEncode;
		davesql.encodeValues = originalEncodeValues;
	};
}

function runRequest(handler, requestOptions) {
	return new Promise((resolve) => {
		const req = {
			method: requestOptions.method,
			lowerpath: requestOptions.lowerpath,
			params: requestOptions.params || {},
			postBody: requestOptions.postBody,
			httpReturn(statusCode, contentType, body, headers) {
				resolve({statusCode, contentType, body, headers});
			}
		};
		handler(req);
	});
}

function createHandler() {
	const restoreEncoding = stubSqlEncoding ();
	const original = {
		feedlandDbStart: feedlanddatabase.start,
		updateNextFeedIfReady: feedlanddatabase.updateNextFeedIfReady,
		checkNextReadingListfReady: feedlanddatabase.checkNextReadingListfReady,
		clearCachedRivers: feedlanddatabase.clearCachedRivers,
		getFeed: feedlanddatabase.getFeed,
		checkOneFeed: feedlanddatabase.checkOneFeed,
		setCategoriesForSubscription: feedlanddatabase.setCategoriesForSubscription,
		getFeedSearch: feedlanddatabase.getFeedSearch,
		getUserInfo: feedlanddatabase.getUserInfo,
		getFeedItems: feedlanddatabase.getFeedItems,
		subscribeToFeed: feedlanddatabase.subscribeToFeed,
		deleteSubscription: feedlanddatabase.deleteSubscription,
		daveappserverStart: daveappserver.start,
		davesqlStart: davesql.start,
		davesqlRun: davesql.runSqltext,
		setInterval: global.setInterval,
		runEveryMinute: daveutils.runEveryMinute,
		restoreEncoding
	};

	feedlanddatabase.start = function (_config, callback) {
		if (callback) {
			callback(undefined);
		}
	};
	if (typeof feedlanddatabase.updateNextFeedIfReady === "function") {
		feedlanddatabase.updateNextFeedIfReady = () => {};
	}
	if (typeof feedlanddatabase.checkNextReadingListfReady === "function") {
		feedlanddatabase.checkNextReadingListfReady = () => {};
	}
	if (typeof feedlanddatabase.clearCachedRivers === "function") {
		feedlanddatabase.clearCachedRivers = () => {};
	}
	feedlanddatabase.getFeed = (url, callback) => callback(undefined, {feedUrl: url, title: "Example title"});
	feedlanddatabase.checkOneFeed = (url, callback) => callback(undefined, {url});
	feedlanddatabase.setCategoriesForSubscription = (_screenname, _url, _jsontext, callback) => {
		if (callback) {
			callback(undefined, {message: "ok"});
		}
	};
	feedlanddatabase.getFeedSearch = (_searchfor, callback) => callback(undefined, []);
	feedlanddatabase.getUserInfo = (screenname, callback) => callback(undefined, {screenname});
	feedlanddatabase.getFeedItems = (url, _maxItems, callback) => callback(undefined, [{feedUrl: url, guid: "g1"}]);

	const subscribeCalls = [];
	const unsubscribeCalls = [];
	const opmlCalls = [];

	feedlanddatabase.subscribeToFeed = (screenname, url, callback) => {
		subscribeCalls.push({screenname, url});
		if (callback) {
			callback(undefined, {feedUrl: url});
		}
	};

	feedlanddatabase.deleteSubscription = (screenname, url, callback) => {
		unsubscribeCalls.push({screenname, url});
		if (callback) {
			callback(undefined, {feedUrl: url});
		}
	};

	feedlanddatabase.processSubscriptionList = (screenname, list, flDeleteEnabled) => {
		opmlCalls.push({screenname, list, flDeleteEnabled});
	};

	let capturedOptions;
	daveappserver.start = (options, callback) => {
		capturedOptions = options;
		if (callback) {
			callback({
				database: {},
				flUpdateFeedsInBackground: false,
				flUseSqlForSockets: false,
				flWebsocketEnabled: false,
				httpRequestTimeoutSecs: 5
			});
		}
	};
	davesql.start = (_config, callback) => {
		if (callback) {
			callback();
		}
	};
	davesql.runSqltext = (sql, callback) => {
		if (sql.startsWith("select version")) {
			callback(undefined, [{version: "8.0"}]);
			return;
		}
		if (sql.startsWith("select feedId from feeds")) {
			callback(undefined, [{feedId: 1}]);
			return;
		}
		if (sql.startsWith("select * from users where emailAddress")) {
			callback(undefined, [{
				screenname: "alice",
				emailAddress: "alice@example.com",
				emailSecret: "secret"
			}]);
			return;
		}
		callback(undefined, []);
	};
	global.setInterval = () => ({clear: () => {}});
	daveutils.runEveryMinute = () => {};

	delete require.cache[require.resolve("../../feedland.js")];
	const feedland = require("../../feedland.js");
	feedland.start();

	return {
		handler: capturedOptions.httpRequest,
		subscribeCalls,
		unsubscribeCalls,
		opmlCalls,
		restore() {
			feedlanddatabase.start = original.feedlandDbStart;
			feedlanddatabase.updateNextFeedIfReady = original.updateNextFeedIfReady;
			feedlanddatabase.checkNextReadingListfReady = original.checkNextReadingListfReady;
			feedlanddatabase.clearCachedRivers = original.clearCachedRivers;
			feedlanddatabase.getFeed = original.getFeed;
			feedlanddatabase.checkOneFeed = original.checkOneFeed;
			feedlanddatabase.setCategoriesForSubscription = original.setCategoriesForSubscription;
			feedlanddatabase.getFeedSearch = original.getFeedSearch;
			feedlanddatabase.getUserInfo = original.getUserInfo;
			feedlanddatabase.getFeedItems = original.getFeedItems;
			feedlanddatabase.subscribeToFeed = original.subscribeToFeed;
			feedlanddatabase.deleteSubscription = original.deleteSubscription;
			feedlanddatabase.processSubscriptionList = original.processSubscriptionList;
			daveappserver.start = original.daveappserverStart;
			davesql.start = original.davesqlStart;
			davesql.runSqltext = original.davesqlRun;
			original.restoreEncoding ();
			global.setInterval = original.setInterval;
			daveutils.runEveryMinute = original.runEveryMinute;
			delete require.cache[require.resolve("../../feedland.js")];
		}
	};
}

const {handler, subscribeCalls, unsubscribeCalls, opmlCalls, restore} = createHandler();

test("GET /getfeed returns JSON feed info", async () => {
	const response = await runRequest(handler, {
		method: "GET",
		lowerpath: "/getfeed",
		params: {
			url: "http://example.com/feed.xml"
		}
	});
	assert.equal(response.statusCode, 200);
	assert.equal(response.contentType, "application/json");
	const parsed = JSON.parse(response.body);
	assert.equal(parsed.feedUrl, "http://example.com/feed.xml");
	assert.equal(parsed.title, "Example title");
});

test("GET /getfeeditems returns array", async () => {
	const response = await runRequest(handler, {
		method: "GET",
		lowerpath: "/getfeeditems",
		params: {
			url: "http://example.com/feed.xml",
			maxItems: "5"
		}
	});
	assert.equal(response.statusCode, 200);
	const parsed = JSON.parse(response.body);
	assert.ok(Array.isArray(parsed));
	assert.equal(parsed[0].guid, "g1");
});

test("GET /subscribe invokes subscribeToFeed with resolved screenname", async () => {
	subscribeCalls.length = 0;
	const response = await runRequest(handler, {
		method: "GET",
		lowerpath: "/subscribe",
		params: {
			url: "http://example.com/feed.xml",
			emailaddress: "alice@example.com",
			emailcode: "secret"
		}
	});
	assert.equal(response.statusCode, 200);
	assert.equal(subscribeCalls.length, 1);
	assert.deepEqual(subscribeCalls[0], {
		screenname: "alice",
		url: "http://example.com/feed.xml"
	});
	const body = JSON.parse(response.body);
	assert.equal(body.feedUrl, "http://example.com/feed.xml");
});

test("GET /unsubscribe delegates to deleteSubscription", async () => {
	unsubscribeCalls.length = 0;
	const response = await runRequest(handler, {
		method: "GET",
		lowerpath: "/unsubscribe",
		params: {
			url: "http://example.com/feed.xml",
			emailaddress: "alice@example.com",
			emailcode: "secret"
		}
	});
	assert.equal(response.statusCode, 200);
	assert.equal(unsubscribeCalls.length, 1);
	assert.deepEqual(unsubscribeCalls[0], {
		screenname: "alice",
		url: "http://example.com/feed.xml"
	});
});

test("GET /unsublist removes each feed via deleteSubscription", async () => {
	unsubscribeCalls.length = 0;
	const response = await runRequest(handler, {
		method: "GET",
		lowerpath: "/unsublist",
		params: {
			list: JSON.stringify(["http://example.com/a.xml", "http://example.com/b.xml"]),
			emailaddress: "alice@example.com",
			emailcode: "secret"
		}
	});
	assert.equal(response.statusCode, 200);
	assert.equal(unsubscribeCalls.length, 2);
	assert.deepEqual(unsubscribeCalls, [
		{screenname: "alice", url: "http://example.com/a.xml"},
		{screenname: "alice", url: "http://example.com/b.xml"}
	]);
	const parsed = JSON.parse(response.body);
	assert.equal(parsed.length, 2);
});

test("POST /opmlsubscribe delegates to processSubscriptionList", async () => {
	opmlCalls.length = 0;
	const opmlText = fs.readFileSync (path.join (__dirname, "..", "fixtures", "opml", "sample-readinglist.opml"), "utf8");
	const response = await runRequest(handler, {
		method: "POST",
		lowerpath: "/opmlsubscribe",
		params: {
			emailaddress: "alice@example.com",
			emailcode: "secret"
		},
		postBody: opmlText
	});
	assert.equal(response.statusCode, 200);
	assert.equal(opmlCalls.length, 1);
	const call = opmlCalls[0];
	assert.equal(call.screenname, "alice");
	assert.equal(call.list.length, 2);
	assert.equal(call.flDeleteEnabled, false);
	const parsed = JSON.parse(response.body);
	assert.equal(parsed.length, 2);
});

test.after(() => {
	restore();
});
