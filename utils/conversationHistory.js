function storeConversationHistory(context, role, message) {
	let conversationHistory = context.variable('user.conversationHistory');
	if (!conversationHistory) {
		conversationHistory = [];
	}
	conversationHistory = [...conversationHistory, { role, message }];
	context.setVariable('user.conversationHistory', conversationHistory);
}

module.exports = {
	storeConversationHistory,
};
