// Verifies selected HTTP handlers by capturing the callback registered with daveappserver.

const test = require("node:test");
const assert = require("node:assert/strict");

const feedlanddatabase = require("feedlanddatabase");
const daveappserver = require("daveappserver");
const davesql = require("davesql");
const daveutils = require("daveutils");

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
		daveappserverStart: daveappserver.start,
		davesqlStart: davesql.start,
		davesqlRun: davesql.runSqltext,
		setInterval: global.setInterval,
		runEveryMinute: daveutils.runEveryMinute
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
		callback(undefined, []);
	};
	global.setInterval = () => ({clear: () => {}});
	daveutils.runEveryMinute = () => {};

	delete require.cache[require.resolve("../../feedland.js")];
	const feedland = require("../../feedland.js");
	feedland.start();

	return {
		handler: capturedOptions.httpRequest,
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
			daveappserver.start = original.daveappserverStart;
			davesql.start = original.davesqlStart;
			davesql.runSqltext = original.davesqlRun;
			global.setInterval = original.setInterval;
			daveutils.runEveryMinute = original.runEveryMinute;
			delete require.cache[require.resolve("../../feedland.js")];
		}
	};
}

const {handler, restore} = createHandler();

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

test.after(() => {
	restore();
});
