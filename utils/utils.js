function extractJsonObject(text) {
	const jsonRegex = /{[\s\S]*?}/;
	const match = text.match(jsonRegex);
	return match ? match[0] : null;
}

module.exports = { extractJsonObject };
