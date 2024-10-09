const { storeConversationHistory } = require('../utils/conversationHistory');

module.exports = {
	metadata: {
		name: 'confirmLeaveRequest',
		properties: {},
		supportedActions: ['router'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		const extractedInfo = JSON.parse(context.variable('extractedInfo')) || {};
		console.log('ConfirmLeaveRequest: Extracted info', extractedInfo);

		let confirmationMessage = `Great! I've collected the following information for your leave request:
		- Leave Type: ${extractedInfo.leavePlanType}
		- Start Date: ${extractedInfo.startDate}
		- End Date: ${extractedInfo.endDate}

Is this information correct? If yes, I'll submit your leave request. If not, please let me know what needs to be changed.`;

		storeConversationHistory(context, 'CHATBOT', confirmationMessage);
		context.reply(confirmationMessage);
		console.log('ConfirmLeaveRequest: Sent confirmation message to user');

		context.waitForReply((userResponse) => {
			storeConversationHistory(context, 'USER', userResponse);

			if (
				userResponse.toLowerCase().includes('yes') ||
				userResponse.toLowerCase().includes('correct')
			) {
				let successMessage =
					'Great! Your leave request has been submitted successfully.';
				context.reply(successMessage);
				storeConversationHistory(context, 'CHATBOT', successMessage);
				context.setVariable('currentState', 'initial');
				context.setVariable('extractedInfo', '{}');
			} else {
				let resetMessage =
					"I understand there are changes needed. Let's start over with your leave request.";
				context.reply(resetMessage);
				storeConversationHistory(context, 'CHATBOT', resetMessage);
				context.setVariable('currentState', 'initial');
				context.setVariable('extractedInfo', '{}');
			}
			context.keepTurn(true);
			context.transition('router');
		});

		done();
	},
};
