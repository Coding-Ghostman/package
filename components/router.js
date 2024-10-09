const { chat } = require('../utils/chat');
const { storeConversationHistory } = require('../utils/conversationHistory');
// const { validateLeaveRequest } = require('../utils/leaveValidation');

module.exports = {
	metadata: {
		name: 'router',
		properties: {},
		supportedActions: ['extractor', 'prompt', 'confirmLeaveRequest'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		const userMessage = context.getUserMessage();
		console.log('Router: Received user message', userMessage);

		const currentState = context.variable('currentState') || 'initial';
		const extractedInfo = JSON.parse(context.variable('extractedInfo')) || {};
		console.log('Router: Current state', currentState);
		console.log('Router: Extracted info', extractedInfo);

		const extractionOrder = ['leavePlanType', 'leaveDates', 'additionalInfo'];

		let nextField = extractionOrder.find((field) => !extractedInfo[field]);

		if (nextField) {
			console.log(`Router: Transitioning to extract ${nextField}`);
			context.setVariable(
				'currentAction',
				`extract${nextField.charAt(0).toUpperCase() + nextField.slice(1)}`
			);
			context.setVariable(
				'currentState',
				`extracting${nextField.charAt(0).toUpperCase() + nextField.slice(1)}`
			);
			context.keepTurn(true);
			context.transition('extractor');
		} else {
			console.log('Router: Transitioning to confirm leave request');
			context.setVariable('currentAction', 'confirmLeaveRequest');
			context.setVariable('currentState', 'confirming');
			context.keepTurn(true);
			context.transition('confirmLeaveRequest');
		}

		// Validate the leave request
		// const validationResult = validateLeaveRequest(extractedInfo, context.variable('user.profile'));
		// if (!validationResult.isValid) {
		// 	context.reply(validationResult.message);
		// 	context.setVariable('currentState', 'initial');
		// 	context.setVariable('extractedInfo', {});
		// 	context.transition('prompt');
		// }

		done();
	},
};
