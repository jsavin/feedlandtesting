// Ensures the primary module exports the expected boot entry point.

const test = require ("node:test");
const assert = require ("node:assert/strict");

const feedland = require ("../../feedland.js");

test ("feedland module exposes a start function", () => {
	assert.equal (typeof feedland.start, "function");
	});
