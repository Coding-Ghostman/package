'use strict';

// Documentation for writing custom components: https://github.com/oracle/bots-node-sdk/blob/master/CUSTOM_COMPONENT.md

// You can use your favorite http client package to make REST calls, however, the node fetch API is pre-installed with the bots-node-sdk.
// Documentation can be found at https://www.npmjs.com/package/node-fetch
// Un-comment the next line if you want to make REST calls using node-fetch.
// const fetch = require('node-fetch');

module.exports = {
	metadata: () => ({
		name: 'utils.addConversation',
		properties: {},
		supportedActions: ['weekday', 'weekend'],
	}),

	/**
	 * invoke methods gets called when the custom component state is executed in the dialog flow
	 * @param {CustomComponentContext} context
	 */
	invoke: async (context, done) => {
		// Retrieve the value of the human' component property.
		const { ragResponse } = context.properties();
		const Response = context.variable('varRagResponse');
		let conversationHistory = context.variable('user.conversationHistory');
		conversationHistory = [
			...conversationHistory,
			{ role: 'ASSISTANT', message: Response.responsePayload.answer },
		];
		context.setVariable('user.conversationHistory', conversationHistory);
		context.reply(Response.responsePayload.answer);
		context.keepTurn(false);
		context.transition();
		done();
		return;
	},
};
