// Verifies that blog.getBlogUrl honors the configured feeds base URL.

const test = require ("node:test");
const assert = require ("node:assert/strict");

const testConfig = require ("../helpers/config.js");
const blog = require ("../../blog");

blog.start ({
	urlForFeeds: testConfig.urlForFeeds
	});

test ("getBlogUrl builds feed URL for screenname", () => {
	const actual = blog.getBlogUrl ("alice");
	assert.equal (actual, `${testConfig.urlForFeeds}alice.xml`);
	});
