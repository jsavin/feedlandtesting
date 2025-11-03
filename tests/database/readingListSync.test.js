const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const davesql = require("davesql");

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

test ("checkSubsForOneUserAndOneReadingList adds missing reading-list feed subscriptions", async () => {
	const requestPath = require.resolve ("request");
	const originalRequestExports = require.cache[requestPath]?.exports || require ("request");

	const opmlText = fs.readFileSync (path.join (__dirname, "..", "fixtures", "opml", "sample-readinglist.opml"), "utf8");
	function requestStub (options, callback) {
		if (typeof options === "string") {
			callback = callback || function () {};
		}
		else if (options && typeof options === "object") {
			callback = callback || options.callback;
		}
		else {
			callback = function () {};
		}
		process.nextTick (() => {
			callback (undefined, {statusCode: 200}, opmlText);
		});
	}
	Object.assign (requestStub, originalRequestExports);

	require.cache[requestPath] = {
		id: requestPath,
		filename: requestPath,
		loaded: true,
		exports: requestStub,
		children: []
	};

	const databasePath = require.resolve ("../../database/database.js");
	delete require.cache[databasePath];
	const database = require ("../../database/database.js");

	const originalRunSqltext = davesql.runSqltext;
	const restoreEncoding = stubSqlEncoding ();
	const insertQueries = [];

	const opmlUrl = "http://example.com/listA.opml";
	const existingSubsSql = "select s.feedUrl";

	davesql.runSqltext = (sql, callback) => {
		if (sql.startsWith (existingSubsSql)) {
			callback (undefined, [{
				listName: "alice",
				feedUrl: "http://example.com/shared.xml",
				categories: ",all,",
				urlReadingList: opmlUrl,
				title: "Shared Feed",
				description: "Desc",
				htmlUrl: "http://example.com/shared.html"
			}]);
			return;
		}
		if (sql.startsWith ("select * from readinglists where opmlurl")) {
			callback (undefined, [{
				opmlUrl,
				title: "Sample Reading List",
				description: "",
				whenCreated: new Date (),
				whenChecked: new Date (),
				ctChecks: 0,
				feedUrls: JSON.stringify (["http://example.com/shared.xml", "http://example.com/new.xml"])
			}]);
			return;
		}
		if (sql.startsWith ("select * from subscriptions where listname")) {
			if (sql.includes ("new.xml")) {
				callback (undefined, []);
			}
			else {
				callback (undefined, [{
					listName: "alice",
					feedUrl: "http://example.com/shared.xml",
					urlReadingList: opmlUrl,
					categories: ",all,"
				}]);
			}
			return;
		}
		if (sql.startsWith ("replace into subscriptions")) {
			insertQueries.push (sql);
			callback (undefined, [{}]);
			return;
		}
		if (sql.startsWith ("select * from feeds where feedUrl")) {
			callback (undefined, [{
				feedUrl: sql.includes ("shared.xml") ? "http://example.com/shared.xml" : "http://example.com/new.xml",
				feedId: 1
			}]);
			return;
		}
		callback (undefined, []);
	};

	try {
		const result = await new Promise ((resolve, reject) => {
			database.checkSubsForOneUserAndOneReadingList ("alice", opmlUrl, (err, urls) => {
				if (err) {
					reject (err);
				}
				else {
					resolve (urls);
				}
			});
		});

		assert.deepEqual (result, ["http://example.com/new.xml"]);
		assert.equal (insertQueries.length, 1);
		assert.ok (insertQueries[0].includes ("http://example.com/new.xml"));
		assert.ok (insertQueries[0].includes (opmlUrl));
	}
	finally {
		davesql.runSqltext = originalRunSqltext;
		restoreEncoding ();
		require.cache[requestPath].exports = originalRequestExports;
		delete require.cache[databasePath];
		require ("../../database/database.js");
	}
});
