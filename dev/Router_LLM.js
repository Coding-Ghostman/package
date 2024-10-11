const { chat } = require('../utils/chat');
const ContextManager = require('../components/ContextManager');

module.exports = {
	metadata: {
		name: 'router_v2',
		properties: {},
		supportedActions: ['extraction', 'prompt', 'confirmation', 'cancel'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Router: Invoked');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		ctxManager.addToConversationHistory('USER', userMessage);
		const extractedInfo = ctxManager.getExtractedInfo();
		const previousAction = ctxManager.getPreviousAction();

		logger.info('Router: User Message', userMessage);
		logger.info('Router: Extracted Info', extractedInfo);
		logger.info('Router: Previous Action', previousAction);
		const routingPreambleOverride = `You are an intelligent Routing Assistant for a HRMS Leave Management Framework. Your task is to determine the next action based on the user query and extracted information for a single leave request.

		Instructions:
		1. Analyze the user query for information related to the current leave request.
		2. Consider the following parameters: leave type, start date, end date.
		3. Respond ONLY with one of the following actions:
		   - "extraction": if there is new information to extract or update for the current request.
		   - "prompt": if more information is needed from the user for the current request.
		   - "confirmation": if all necessary information is present (leave type, start date, and end date) and ready for confirmation.
		   - "cancel": if the user wants to cancel the current request or start over.
		   - "interruption": if the user's query is unrelated to the leave request process (e.g., asking for a joke, general questions).

		Remember: Your response must be ONLY one of the above actions. Do not provide any explanations or additional text. We are handling only one leave request at a time.`;

		const prompt = `User Query: ${userMessage}
			Prompt That was provided to User: ${ctxManager.getTestResponse()}
			Extracted Information: ${JSON.stringify(extractedInfo)}
			Previous Action: ${previousAction}

		Based on the user query, extracted information, previous action, and conversation history, determine the next action for the current leave request. If the user's query is unrelated to the leave request process, choose the "interruption" action.
		`;

		const response = await chat(prompt, {
			maxTokens: 100,
			temperature: 0,
			docs: [
				{
					title: 'Sick',
					text: 'Used if the employee is unable to attend work due to a medical reason, such as they are ill, or have to attend a medical appointment',
				},
				{
					title: 'Annual',
					text: 'The employee is entitled to take 20 days annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
				},
				{
					title: 'Remote',
					text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
				},
			],
			preambleOverride: routingPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
		});

		let action = response.chatResponse.text.toLowerCase().trim();
		logger.info(`Router: LLM suggested action - ${action}`);

		// Handle interruptions
		if (action === 'interruption') {
			const interruptionResponse = await handleInterruption(
				ctxManager,
				userMessage
			);
			ctxManager.reply(interruptionResponse);
			ctxManager.addToConversationHistory('CHATBOT', interruptionResponse);
			ctxManager.transition('router');
		} else {
			// Existing logic for other actions
			if (action === 'extraction' && previousAction === 'extraction') {
				action = 'prompt';
				logger.info(
					`Router: Breaking Extractor-Router loop, changing action to prompt`
				);
			}

			const { leaveType, startDate, endDate } = extractedInfo;
			if (leaveType && startDate && endDate && action !== 'cancel') {
				action = 'confirmation';
				logger.info(
					`Router: All information present, setting action to confirmation`
				);
			}

			logger.info(`Router: Final determined action - ${action}`);

			ctxManager.keepTurn(true);
			ctxManager.transition(action);
			ctxManager.setPreviousAction(action);

			if (action === 'cancel') {
				ctxManager.setExtractedInfo({});
				ctxManager.setNullExtractedInfo({});
			}

			ctxManager.addToConversationHistory('SYSTEM', `Routed to ${action}`);
		}

		done();
	},
};

async function handleInterruption(ctxManager, userMessage) {
	const interruptionPreamble = `You are an AI assistant handling an interruption in a leave request process. Your task is to respond to the user's query and ask if they want to continue with the leave request or exit the process.

	Instructions:
	1. Briefly answer the user's query or acknowledge their interruption.
	2. Ask if they want to continue with the leave request or exit the process.
	3. Keep the response friendly and conversational.
	4. Limit the response to 30 words or less.
	5. Don't try to answer outside the HR Related Context.
	`;

	const interruptionPrompt = `User Query: ${userMessage}

	Respond to the user's query and ask if they want to continue with the leave request or exit the process.`;

	const interruptionResponse = await chat(interruptionPrompt, {
		maxTokens: 200,
		temperature: 0.7,
		preambleOverride: interruptionPreamble,
	});

	return interruptionResponse.chatResponse.text;
}
