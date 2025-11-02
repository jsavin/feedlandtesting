// Confirms feedland.start delegates to daveappserver and passes options through.

const test = require ("node:test");
const assert = require ("node:assert/strict");

const daveappserver = require ("daveappserver");
const feedlanddatabase = require ("feedlanddatabase");
const davesql = require ("davesql");
const daveutils = require ("daveutils");

test ("start passes options to daveappserver", () => {
	const originalAppStart = daveappserver.start;
	const originalDbStart = feedlanddatabase.start;
	const originalUpdateNextFeedIfReady = feedlanddatabase.updateNextFeedIfReady;
	const originalCheckNextReadingList = feedlanddatabase.checkNextReadingListfReady;
	const originalClearCachedRivers = feedlanddatabase.clearCachedRivers;
	const originalDbRunSqltext = davesql.runSqltext;
	const originalDavesqlStart = davesql.start;
	const originalSetInterval = global.setInterval;
	const originalRunEveryMinute = daveutils.runEveryMinute;

	let capturedOptions;

	global.setInterval = () => ({clear: () => {}});
	daveutils.runEveryMinute = () => {};
	feedlanddatabase.start = (_config, callback) => {
		if (callback) {
			callback (undefined);
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
	davesql.start = (_config, callback) => {
		if (callback) {
			callback ();
		}
	};
	davesql.runSqltext = (sql, callback) => {
		if (sql.startsWith ("select version")) {
			callback (undefined, [{version: "8.0"}]);
			return;
		}
		if (sql.startsWith ("select feedId from feeds")) {
			callback (undefined, [{feedId: 1}]);
			return;
		}
		callback (undefined, []);
	};
	daveappserver.start = (options, callback) => {
		capturedOptions = options;
		if (callback) {
			callback ({
				database: {},
				flUpdateFeedsInBackground: false,
				flUseSqlForSockets: false,
				flWebsocketEnabled: false,
				httpRequestTimeoutSecs: 5
			});
		}
	};

	delete require.cache[require.resolve ("../../feedland.js")];
	const feedland = require ("../../feedland.js");

	try {
		feedland.start ();
		assert.ok (capturedOptions, "daveappserver.start should be invoked");
	}
	finally {
		daveappserver.start = originalAppStart;
		feedlanddatabase.start = originalDbStart;
		if (originalUpdateNextFeedIfReady !== undefined) {
			feedlanddatabase.updateNextFeedIfReady = originalUpdateNextFeedIfReady;
		}
		if (originalCheckNextReadingList !== undefined) {
			feedlanddatabase.checkNextReadingListfReady = originalCheckNextReadingList;
		}
		if (originalClearCachedRivers !== undefined) {
			feedlanddatabase.clearCachedRivers = originalClearCachedRivers;
		}
		davesql.runSqltext = originalDbRunSqltext;
		davesql.start = originalDavesqlStart;
		global.setInterval = originalSetInterval;
		daveutils.runEveryMinute = originalRunEveryMinute;
		delete require.cache[require.resolve ("../../feedland.js")];
	}
	});
