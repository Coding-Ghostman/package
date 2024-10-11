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
			'policy',
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

		// Step 2: Handle profile check
		if (initialAction === 'profilecheck') {
			logger.info('Router: Handling profile check');
			await handleProfileCheck(ctxManager, userProfile);
			ctxManager.transition('router');
			done();
			return;
		}

		// Step 3: Handle interruption
		if (initialAction === 'interruption') {
			logger.info('Router: Handling interruption');
			const interruptionResponse = await handleInterruption(
				ctxManager,
				userMessage
			);
			ctxManager.reply(interruptionResponse);
			ctxManager.addToConversationHistory('CHATBOT', interruptionResponse);
			ctxManager.transition('router');
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
		} else if (currentAction === 'policy') {
			logger.info('Router: Handling policy search');
			ctxManager.transition('policy');
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

	const routingPreamble = `You are an intelligent Routing Assistant for a HRMS Leave Management Framework. Your task is to determine the next action based on the user query, extracted information, and user profile for a single leave request.

  Instructions:
  1. Analyze the user query for information related to the current leave request, user profile inquiries, or potential interruptions.
  2. Consider the following parameters: leave type, start date, end date, and user profile information.
  3. Respond ONLY with one of the following actions:
     - "extraction": if there is new information to extract or update for the current request.
     - "prompt": if more information is needed from the user for the current request.
     - "confirmation": if all necessary information is present and ready for confirmation.
     - "cancel": if the user wants to cancel the current request or start over.
     - "interruption": if the user's query is unrelated to the leave request process or requires clarification before continuing.
     - "profileCheck": if the user is asking about their profile information or leave balance.
		 - "policy": if the user is asking about the policy related to leave requests.

  Remember: Your response must be ONLY one of the above actions. Do not provide any explanations or additional text. We are handling only one leave request at a time.`;

	const prompt = `User Query: ${userMessage}
    Prompt That was provided to User: ${ctxManager.getTestResponse()}
    Extracted Information: ${JSON.stringify(extractedInfo)}
    Previous Action: ${previousAction}
    User Profile: ${JSON.stringify(userProfile)}

  Based on the user query, extracted information, previous action, user profile, and conversation history, determine the next action for the current leave request, user profile inquiry, or potential interruption.`;

	logger.info('determineInitialAction: Sending chat request');
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
		preambleOverride: routingPreamble,
		chatHistory: ctxManager.getConversationHistory(),
	});

	const result = response.chatResponse.text.toLowerCase().trim();
	logger.info(`determineInitialAction: Completed with result - ${result}`);
	return result;
}

async function determineFinalAction(ctxManager, currentAction) {
	const logger = ctxManager.context.logger();
	logger.info('determineFinalAction: Started');
	const extractedInfo = ctxManager.getExtractedInfo();
	const { leaveType } = extractedInfo;

	if (leaveType) {
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
				return 'confirmation';
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

	if (action === 'confirmation') {
		const confirmationResult = await checkConfirmation(ctxManager);
		if (confirmationResult === 'confirmed') {
			logger.info('handleFinalAction: User confirmed the leave request');
			// Generate and send a summary of the leave request
			const summary = generateLeaveSummary(ctxManager.getExtractedInfo());
			ctxManager.reply(summary);
			ctxManager.addToConversationHistory('CHATBOT', summary);
			
			// Reset the context for a new request
			ctxManager.setExtractedInfo({});
			ctxManager.setNullExtractedInfo({});
			ctxManager.keepTurn(false);
			ctxManager.transition('');
			done();
			return;
		} else if (confirmationResult === 'denied') {
			logger.info('handleFinalAction: User denied the leave request');
			ctxManager.reply("I understand you don't want to proceed with this leave request. Is there anything else I can help you with?");
			ctxManager.transition('router');
		} else {
			logger.info('handleFinalAction: Confirmation unclear, asking for clarification');
			ctxManager.transition('confirmation');
		}
	} else if (action === 'cancel') {
		logger.info('handleFinalAction: Cancelling, resetting extracted info');
		ctxManager.setExtractedInfo({});
		ctxManager.setNullExtractedInfo({});
		ctxManager.reply("I've cancelled your current leave request. Is there anything else I can help you with?");
		ctxManager.transition('router');
	} else {
		ctxManager.transition(action);
	}

	ctxManager.setPreviousAction(action);
	ctxManager.addToConversationHistory('SYSTEM', `Routed to ${action}`);
	ctxManager.keepTurn(true);
	logger.info('handleFinalAction: Completed');
}

async function checkConfirmation(ctxManager) {
	const logger = ctxManager.context.logger();
	logger.info('checkConfirmation: Started');

	const userMessage = ctxManager.getUserMessage();
	const extractedInfo = ctxManager.getExtractedInfo();

	const confirmationPreamble = `You are an AI assistant processing a leave request confirmation. Your task is to determine if the user has confirmed, denied, or if their response is unclear.

	Instructions:
	1. Analyze the user's response to the leave request summary.
	2. Determine if the user has clearly confirmed, denied, or if their response is unclear.
	3. Respond ONLY with one of the following:
	   - "confirmed": if the user has clearly agreed to submit the leave request.
	   - "denied": if the user has clearly indicated they do not want to proceed.
	   - "unclear": if the user's response is ambiguous or requires further clarification.

	Remember: Your response must be ONLY one of the above options. Do not provide any explanations or additional text.`;

	const confirmationPrompt = `User Response: ${userMessage}
	Leave Request Details: ${JSON.stringify(extractedInfo)}

	Based on the user's response, determine if they have confirmed, denied, or if their response is unclear regarding the leave request.`;

	const response = await chat(confirmationPrompt, {
		maxTokens: 50,
		temperature: 0,
		preambleOverride: confirmationPreamble,
	});

	const result = response.chatResponse.text.toLowerCase().trim();
	logger.info(`checkConfirmation: Completed with result - ${result}`);
	return result;
}

function generateLeaveSummary(extractedInfo) {
	// Generate a summary of the leave request
	const summary = `Great! I've submitted your leave request. Here's a summary:

Leave Type: ${extractedInfo.leaveType}
Start Date: ${extractedInfo.startDate}
End Date: ${extractedInfo.endDate}
${extractedInfo.workingDays ? `Working Days: ${extractedInfo.workingDays}` : ''}
${extractedInfo.leaveDestination ? `Destination: ${extractedInfo.leaveDestination}` : ''}
${extractedInfo.advanceSalary ? 'Advance Salary: Requested' : ''}

Your request has been sent for approval. You'll be notified once it's processed. Is there anything else I can help you with?`;

	return sum;
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

	const interruptionPreamble = `You are an AI assistant handling an interruption in a leave request process. Your task is to respond to the user's query and guide them back to the leave request process or confirm if they want to exit.

	Instructions:
	1. Briefly acknowledge the user's query or interruption.
	2. If the leave type has changed, mention this change and ask if they want to continue with the new leave type.
	3. If the leave type hasn't changed, ask if they want to continue with the current leave request or exit the process.
	4. Keep the response friendly and conversational.
	5. Limit the response to 40 words or less.
	6. Don't try to answer questions outside the HR-related context.
	`;

	const interruptionPrompt = `User Query: ${userMessage}
  Old Leave Type: ${oldLeaveType}
  New Leave Type: ${newLeaveType}
  Extracted Info: ${JSON.stringify(updatedExtractedInfo)}

  Respond to the user's query, acknowledge any changes in leave type, and ask if they want to continue with the leave request process or exit.`;

	const interruptionResponse = await chat(interruptionPrompt, {
		maxTokens: 200,
		temperature: 0.7,
		preambleOverride: interruptionPreamble,
	});

	logger.info(
		'handleInterruption: Generated response',
		interruptionResponse.chatResponse.text
	);
	return interruptionResponse.chatResponse.text;
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

	const profileCheckResponse = await chat(profileCheckPrompt, {
		maxTokens: 200,
		temperature: 0.7,
		preambleOverride: profileCheckPreamble,
	});

	logger.info(
		'handleProfileCheck: Generated response',
		profileCheckResponse.chatResponse.text
	);
	ctxManager.reply(profileCheckResponse.chatResponse.text);
	ctxManager.addToConversationHistory(
		'CHATBOT',
		profileCheckResponse.chatResponse.text
	);
	logger.info('handleProfileCheck: Completed');
}