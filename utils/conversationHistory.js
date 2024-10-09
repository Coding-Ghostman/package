function storeConversationHistory(context, role, messageOrToolResults) {
	let conversationHistory = context.variable('user.conversationHistory');
	if (!conversationHistory) {
		conversationHistory = [];
	}
	if (role === 'TOOL') {
		conversationHistory = [
			...conversationHistory,
			{ role, toolResults: messageOrToolResults },
		];
	} else {
		conversationHistory = [
			...conversationHistory,
			{ role, message: messageOrToolResults },
		];
	}
	context.setVariable('user.conversationHistory', conversationHistory);
}

module.exports = { storeConversationHistory };
