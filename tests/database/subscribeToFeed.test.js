// Exercises subscribeToFeed short-circuit and quota enforcement paths.

const test = require ("node:test");
const assert = require ("node:assert/strict");

const database = require ("../../database/database.js");
const davesql = require ("davesql");
const reallysimple = require ("reallysimple");
const feedhunter = require ("feedhunter");

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

	test ("subscribeToFeed returns cached feed when already subscribed", async () => {
		const originalRunSqltext = davesql.runSqltext;
		const restoreEncoding = stubSqlEncoding ();
		const originalReadFeed = reallysimple.readFeed;
		const originalFeedHunter = feedhunter.huntForFeed;

		const feedUrl = "http://example.com/feed.xml";
		const feedRec = {
			feedUrl,
			feedId: 21,
			title: "Example Feed",
			htmlUrl: "http://example.com",
			description: "Example description",
			pubDate: new Date ("2025-10-30T08:00:00Z"),
			whenCreated: new Date ("2025-10-30T08:00:00Z"),
			whenUpdated: new Date ("2025-10-30T08:00:00Z"),
			ctItems: 10,
			ctSubs: 5,
			ctChecks: 3
			};

		const queries = [];
		reallysimple.readFeed = (_url, callback) => callback (undefined, {items: []});
		feedhunter.huntForFeed = (_url, _options, callback) => callback (undefined);
		davesql.runSqltext = (sql, callback) => {
			queries.push (sql);
			if (sql.startsWith ("select * from feeds")) {
				callback (undefined, [feedRec]);
				return;
				}
			if (sql.startsWith ("select * from subscriptions")) {
				callback (undefined, [{
					listName: "alice",
					feedUrl,
					categories: ",all,",
					whenUpdated: new Date ()
					}]);
				return;
				}
			callback (undefined, []);
			};

		try {
			const result = await new Promise ((resolve, reject) => {
				database.subscribeToFeed ("alice", feedUrl, (err, data) => {
					if (err) {
						reject (err);
						}
					else {
						resolve (data);
						}
					});
				});

			assert.equal (result.feedUrl, feedRec.feedUrl);
			assert.equal (result.feedId, feedRec.feedId);
			assert.ok (queries.some ((sql) => sql.startsWith ("select * from feeds")));
			assert.ok (!queries.some ((sql) => sql.startsWith ("replace into subscriptions")), "should not have attempted to add subscription");
			}
		finally {
			davesql.runSqltext = originalRunSqltext;
			restoreEncoding ();
			reallysimple.readFeed = originalReadFeed;
			feedhunter.huntForFeed = originalFeedHunter;
			}
		});

	test ("subscribeToFeed enforces max new subscription quota", async () => {
		const originalRunSqltext = davesql.runSqltext;
		const restoreEncoding = stubSqlEncoding ();
		const originalReadFeed = reallysimple.readFeed;

		const feedUrl = "http://example.net/new-feed.xml";
		const queries = [];

		reallysimple.readFeed = (_url, callback) => callback (undefined, {items: []});
		davesql.runSqltext = (sql, callback) => {
			queries.push (sql);
			if (sql.startsWith ("select * from feeds")) {
				callback (undefined, []);
				return;
				}
			if (sql.startsWith ("select count(*) as theCount from feeds where whoFirstSubscribed")) {
				callback (undefined, [{theCount: 100}]); // equal to default maxNewFeedSubscriptions
				return;
				}
			callback (undefined, []);
			};

		try {
			const err = await new Promise ((resolve) => {
				database.subscribeToFeed ("alice", feedUrl, (error) => resolve (error));
				});

			assert.ok (err, "should return an error when over quota");
			assert.match (err.message, /Can't add the new subscription/i);
			assert.ok (!queries.some ((sql) => sql.startsWith ("insert into feeds")), "should not attempt to insert when quota exceeded");
			}
		finally {
			davesql.runSqltext = originalRunSqltext;
			restoreEncoding ();
			reallysimple.readFeed = originalReadFeed;
			}
		});
