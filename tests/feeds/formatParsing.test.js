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

test ("RSS 2.0 fixture parses with namespaces and enclosures", async () => {
	const feed = await parseFixture ("rss2.xml");
	assert.equal (feed.head.title, "Sample RSS 2.0");
	assert.ok (feed.items.length > 0);
	const first = feed.items [0];
	assert.equal (first.enclosures.length, 1);
	assert.equal (first.enclosures [0].type, "audio/mpeg");
	assert.equal (first.categories [0], "technology");
	assert.ok (first["content:encoded"]);
});

test ("Atom 1.0 fixture parses with enclosure links", async () => {
	const feed = await parseFixture ("atom.xml");
	assert.equal (feed.head.title, "Sample Atom Feed");
	assert.ok (feed.items.length > 0);
	const entry = feed.items [0];
	assert.equal (entry.enclosures.length, 1);
	const enclosure = entry.enclosures [0];
	assert.equal (enclosure.type, "audio/mpeg");
	assert.equal (entry.categories [0], "podcast");
	assert.ok (Array.isArray (entry["atom:link"]), "atom:link array should be present for rel attributes");
	assert.ok (entry.summary.includes ("Episode summary"));
});

test ("RSS 1.0 / RDF fixture parses with Dublin Core metadata", async () => {
	const feed = await parseFixture ("rdf.xml");
	assert.equal (feed.head.title, "Sample RSS 1.0");
	assert.ok (feed.items.length > 0);
	const item = feed.items [0];
	assert.equal (item.author, "Example Author");
	assert.equal (item["dc:creator"]["#"], "Example Author");
	assert.ok (item["content:encoded"]["#"].includes ("Full content"));
});
