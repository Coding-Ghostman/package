const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');

module.exports = {
	metadata: {
		name: 'router_v3',
		properties: {},
		supportedActions: [
			'extraction',
			'prompt',
			'confirmation',
			'cancel',
			'summary',
		],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Router: Invoked');
		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		ctxManager.addToConversationHistory('USER', userMessage);
		const extractedInfo = ctxManager.getExtractedInfo();
		const previousAction = ctxManager.getPreviousAction();
		const userProfile = ctxManager.getUserProfile();
		ctxManager.setUseLlama(true);

		logger.info('Router: User Message', userMessage);
		logger.info('Router: Extracted Info', extractedInfo);
		logger.info('Router: Previous Action', previousAction);
		logger.info('Router: User Profile', userProfile);

		// Step 1: Determine initial action
		logger.info('Router: Determining initial action');
		const initialAction = await determineInitialAction(
			ctxManager,
			userMessage,
			extractedInfo,
			previousAction,
			userProfile
		);
		logger.info(`Router: Initial action - ${initialAction}`);

		// Step 3: Handle interruption
		if (initialAction === 'interruption') {
			logger.info('Router: Handling interruption or Policy');
			ctxManager.transition('policy');
			done();
			return;
		}

		// Step 4: Handle extraction if needed
		let currentAction = initialAction;
		if (currentAction === 'extraction' || currentAction === 'prompt') {
			logger.info('Router: Handling extraction');
			ctxManager.transition('extraction');
			done();
			return;
		}

		if (currentAction === 'summary') {
			logger.info('Router: Handling summary');
			ctxManager.transition('summary');
			done();
			return;
		}

		// Step 5: Determine final action
		logger.info('Router: Determining final action');
		const finalAction = await determineFinalAction(ctxManager, currentAction);
		logger.info(`Router: Final determined action - ${finalAction}`);

		// Step 6: Handle the final action
		logger.info(`Router: Handling final action - ${finalAction}`);
		await handleFinalAction(ctxManager, finalAction);

		logger.info('Router: Completed');
		done();
	},
};

async function determineInitialAction(
	ctxManager,
	userMessage,
	extractedInfo,
	previousAction,
	userProfile
) {
	const logger = ctxManager.context.logger();
	logger.info('determineInitialAction: Started');

	const routingPreamble = `You are an intelligent Routing Assistant for a HRMS Leave Management Framework. Your task is to determine the next action based on the user query andextracted information for a single leave request.

  Instructions:
  1. Analyze the user query for information related to the current leave request or potential interruptions.
  2. Consider the following parameters: leave type, start date, end date
  3. Respond ONLY with one of the following actions:
     - "extraction": if there is new information to extract or update for the current request.
     - "prompt": if more information is needed from the user for the current request.
     - "summary": if all necessary information is present and ready for confirmation.
     - "cancel": If the user wants to cancel the current request or start over.
     - "interruption": If the user's query is unrelated to the leave request process or answer greeting and general Questions or If the user is asking about the policy related to leave requests or anything related to self validation like "Can I apply for this leave type?" or you feel like the answer is not related to the leave request but related to HR policies or any questions related to DMCC Company.

  Remember: Your response must be ONLY one of the above actions. Do not provide any explanations or additional text. We are handling only one leave request at a time.`;

	const prompt = `User Query: ${userMessage}
    Prompt That was provided to User: ${ctxManager.getTestResponse()}
    Extracted Information: ${JSON.stringify(extractedInfo)}
    Previous Action: ${previousAction}

  Based on the user query, extracted information, previous action, user profile, and conversation history, determine the next action for the current leave request, user profile inquiry, or potential interruption.`;

	logger.info('determineInitialAction: Sending chat request');
	const useLlama = ctxManager.getUseLlama();
	const response = await chat(prompt, {
		maxTokens: 100,
		temperature: 0,
		useLlama: useLlama,
		docs: [
			{
				title: 'Sick',
				text: 'Used if the employee is unable to attend work due to a medical reason, such as they are ill, or have to attend a medical appointment',
			},
			{
				title: 'Annual',
				text: 'The employee is entitled to take  annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
			},
			{
				title: 'Remote',
				text: 'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
			},
		],
		preambleOverride: routingPreamble,
		chatHistory: ctxManager.getConversationHistory(),
	});

	const result = useLlama
		? response.chatResponse.choices[0].message.content[0].text
				.toLowerCase()
				.trim()
		: response.chatResponse.text.toLowerCase().trim();
	logger.info(`determineInitialAction: Completed with result - ${result}`);
	return result;
}

async function determineFinalAction(ctxManager, currentAction) {
	const logger = ctxManager.context.logger();
	logger.info('determineFinalAction: Started');
	const extractedInfo = ctxManager.getExtractedInfo();
	const { leaveType, startDate, endDate } = extractedInfo;

	if (leaveType && startDate && endDate) {
		const config = ctxManager.getLeaveTypeConfig(leaveType);
		if (config) {
			const missingMandatoryParams = config.mandatoryParams.filter(
				(param) =>
					extractedInfo[param.name] === null ||
					extractedInfo[param.name] === undefined
			);

			if (missingMandatoryParams.length === 0 && currentAction !== 'cancel') {
				logger.info(
					'determineFinalAction: All mandatory info present, returning confirmation'
				);
				return 'summary';
			}
		}
	}

	if (
		currentAction === 'extraction' &&
		ctxManager.getPreviousAction() === 'extraction'
	) {
		logger.info(
			'determineFinalAction: Consecutive extraction, returning prompt'
		);
		return 'prompt';
	}

	logger.info(
		`determineFinalAction: Returning current action - ${currentAction}`
	);
	return currentAction;
}

async function handleFinalAction(ctxManager, action) {
	const logger = ctxManager.context.logger();
	logger.info(`handleFinalAction: Started with action - ${action}`);
	ctxManager.keepTurn(true);
	ctxManager.transition(action);
	ctxManager.setPreviousAction(action);

	if (action === 'cancel') {
		logger.info('handleFinalAction: Cancelling, resetting extracted info');
		ctxManager.setExtractedInfo({});
		ctxManager.setNullExtractedInfo({});
	}

	ctxManager.addToConversationHistory('SYSTEM', `Routed to ${action}`);
	logger.info('handleFinalAction: Completed');
}

async function handleInterruption(ctxManager, userMessage) {
	const logger = ctxManager.context.logger();
	logger.info('handleInterruption: Started');

	const extractedInfo = ctxManager.getExtractedInfo();
	const oldLeaveType = extractedInfo.leaveType;

	const updatedExtractedInfo = ctxManager.getExtractedInfo();
	const newLeaveType = updatedExtractedInfo.leaveType;

	// Check if the leave type has changed
	if (newLeaveType && newLeaveType !== oldLeaveType) {
		logger.info(
			`handleInterruption: Leave type changed from ${oldLeaveType} to ${newLeaveType}`
		);

		// Reset extracted info and populate with new leave type parameters
		ctxManager.setExtractedInfo({ leaveType: newLeaveType });
		ctxManager.setNullExtractedInfo({});
		const result = ctxManager.populateLeaveTypeParams(newLeaveType);

		if (result) {
			logger.info(
				'handleInterruption: Updated extracted info with new leave type parameters',
				result.extractedInfo
			);
		} else {
			logger.warn(
				`handleInterruption: Unable to populate parameters for ${newLeaveType}`
			);
		}
	}

	const interruptionPreamble = `You are an AI assistant handling interruptions, greetings, and general inquiries in an HRMS Leave Management system. Your task is to respond to the user's query and guide them back to the leave request process if necessary.

Instructions:
1. Briefly acknowledge the user's query, greeting, or interruption.
2. Keep the response friendly, professional, and conversational.
3. Limit the response to 40 words or less.
4. Only answer questions related to HR, leave management, or general work policies.
5. For queries outside the HRMS context, politely redirect the user to the appropriate department or resource.
6. If appropriate, guide the user back to the leave request process or ask if they want to continue.
7. Do not provide any personal opinions or advice outside of established HR policies.`;

	const interruptionPrompt = `User Query: ${userMessage}
  Extracted Info: ${JSON.stringify(updatedExtractedInfo)}
	User Profile: ${JSON.stringify(ctxManager.getUserProfile())}


  Respond to the user's query, acknowledge any changes in leave type, and ask if they want to continue with the leave request process or exit.`;
	const useLlama = ctxManager.getUseLlama();
	const interruptionResponse = await chat(interruptionPrompt, {
		maxTokens: 200,
		temperature: 0.7,
		preambleOverride: interruptionPreamble,
		chatHistory: ctxManager.getConversationHistory(),
		useLlama: useLlama,
	});

	logger.info(
		'handleInterruption: Generated response',
		interruptionResponse.chatResponse.text
	);
	return useLlama
		? interruptionResponse.chatResponse.choices[0].message.content[0].text
		: interruptionResponse.chatResponse.text;
}

async function handleProfileCheck(ctxManager, userProfile) {
	const logger = ctxManager.context.logger();
	logger.info('handleProfileCheck: Started');

	const profileCheckPreamble = `You are an AI assistant providing information about a user's profile in an HRMS Leave Management system. Your task is to respond to the user's query about their profile information or leave balance.

	Instructions:
	1. Provide relevant information from the user's profile based on their query.
	2. If asked about leave balance, provide the available leave days for each leave type.
	3. Keep the response friendly, concise, and informative.
	4. Limit the response to 50 words or less.
	5. Only provide information that is present in the user's profile.`;

	const profileCheckPrompt = `User Profile: ${JSON.stringify(userProfile)}
	User Query: ${ctxManager.getUserMessage()}

	Respond to the user's query about their profile information or leave balance based on the provided user profile.`;
	const useLlama = ctxManager.getUseLlama();
	const profileCheckResponse = await chat(profileCheckPrompt, {
		maxTokens: 200,
		temperature: 0.7,
		preambleOverride: profileCheckPreamble,
		useLlama: useLlama,
		// chatHistory: ctxManager.getConversationHistory(),
	});

	logger.info(
		'handleProfileCheck: Generated response',
		profileCheckResponse.chatResponse.text
	);
	const result = useLlama
		? profileCheckResponse.chatResponse.choices[0].message.content[0].text
		: profileCheckResponse.chatResponse.text;
	ctxManager.reply(result);
	ctxManager.addToConversationHistory(
		'CHATBOT',
		profileCheckResponse.chatResponse.text
	);
	logger.info('handleProfileCheck: Completed');
}
