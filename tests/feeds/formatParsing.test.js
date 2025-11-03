// Validates that the feed reader stack can parse the core feed formats we support.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const davefeedread = require("davefeedread");

function parseFixture (filename) {
	const xmltext = fs.readFileSync (path.join (__dirname, "..", "fixtures", "feeds", filename), "utf8");
	return new Promise ((resolve, reject) => {
		davefeedread.parseString (xmltext, undefined, (err, feed) => {
			if (err) {
				reject (err);
			}
			else {
				resolve (feed);
			}
		});
	});
}

test ("RSS 2.0 fixture parses with at least one item", async () => {
	const feed = await parseFixture ("rss2.xml");
	assert.equal (feed.head.title, "Sample RSS 2.0");
	assert.ok (feed.items.length > 0);
});

test ("Atom 1.0 fixture parses", async () => {
	const feed = await parseFixture ("atom.xml");
	assert.equal (feed.head.title, "Sample Atom Feed");
	assert.ok (feed.items.length > 0);
});

test ("RSS 1.0 / RDF fixture parses", async () => {
	const feed = await parseFixture ("rdf.xml");
	assert.equal (feed.head.title, "Sample RSS 1.0");
	assert.ok (feed.items.length > 0);
});
