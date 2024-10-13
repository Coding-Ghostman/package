const { chat } = require('../utils/chat');
const ContextManager = require('./ContextManager');
const moment = require('moment');
const leaveConfig = require('../utils/leaveConfig');
const { submitLeaveRequest } = require('../utils/leaveRequestSubmission');

module.exports = {
	metadata: {
		name: 'confirmation_v3',
		properties: {},
		supportedActions: ['router', 'cancel'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Confirmation_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();
		logger.info('Confirmation_LLM: Extracted Info:', extractedInfo);
		logger.info('Confirmation_LLM: User Message:', userMessage);

		// Format dates
		const formatDate = (dateString) => {
			const date = moment(dateString);
			return `${date.format('Do MMMM')} (${date.format('dddd')})`;
		};

		const formattedStartDate = formatDate(extractedInfo.startDate);
		const formattedEndDate = formatDate(extractedInfo.endDate);

		const leaveTypeConfig = leaveConfig[extractedInfo.leaveType];
		const mandatoryParams = leaveTypeConfig
			? leaveTypeConfig.mandatoryParams
			: [];

		const confirmationPreamble = `
You are Aisha, a friendly and helpful HR colleague in the HR department.  Your task is to generate a final confirmation message for the user's leave request and inform them that their request has been submitted.

Instructions:
1. Confirm that the leave request has been successfully submitted.
2. Summarize the key details of the leave request (type, dates, working days).
3. Mention any specific details related to the leave type (e.g., remote work location).
4. Keep the overall tone warm, approachable, and professional.
5. Limit your response to 10 words or less.
6. Check the Conversation History to have the context before sending the confirmation message.
`;

		const prompt = `
Extracted Info: ${JSON.stringify(extractedInfo)}
User Message: ${userMessage}
Formatted Start Date: ${formattedStartDate}
Formatted End Date: ${formattedEndDate}
Mandatory Parameters: ${JSON.stringify(mandatoryParams)}

Generate a final confirmation message for the leave request, informing the user that their request has been submitted.
`;

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.5,
			preambleOverride: confirmationPreamble,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info(
			'Confirmation_LLM: Generated confirmation',
			chatResponse.chatResponse.text
		);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		// Simulating leave request submission
		logger.info('Confirmation_LLM: Submitting leave request');

		// Get user profile to retrieve personNumber
		const userProfile = ctxManager.getUserProfile();

		// Prepare request body
		const requestBody = {
			personNumber: userProfile.personNumber,
			legalEntityId: 300000002024060,
			absenceType: extractedInfo.leaveType,
			startDateDuration: extractedInfo.startDayType ? 1 : 0.5,
			endDateDuration: extractedInfo.endDayType ? 1 : 0.5,
			startDate: extractedInfo.startDate,
			endDate: extractedInfo.endDate,
			absenceStatusCd: 'SUBMITTED',
			absenceRecordingDFF: [
				{
					__FLEX_Context: '300000009102443',
					__FLEX_Context_DisplayValue: extractedInfo.leaveType,
					annualLeaveAdvanceSalary: extractedInfo.advanceSalary ? 'Y' : 'N',
					annualLeaveAdvanceSalary_Display: extractedInfo.advanceSalary
						? 'Yes'
						: 'No',
					leaveDestination:
						extractedInfo.leaveDestination === 'local' ? 'Local' : 'Abroad',
				},
			],
		};

		// Submit the leave request
		const submissionResult = await submitLeaveRequest(requestBody, {
			username: process.env.HRMS_USERNAME || 'testuser1@conneqtiongroup.com',
			password: process.env.HRMS_PASSWORD || 'DMCC@1234',
		});

		if (submissionResult.success) {
			logger.info('Confirmation_LLM: Leave request submitted successfully');
			// You might want to add some information to the context or send a success message to the user
		} else {
			logger.error(
				'Confirmation_LLM: Failed to submit leave request',
				submissionResult.error
			);
			// Handle the error, perhaps by informing the user or retrying
		}

		// Clear conversation history and extracted info after successful submission
		ctxManager.clearConversationHistory();
		ctxManager.setExtractedInfo({});
		ctxManager.setNullExtractedInfo({});

		ctxManager.transition('router');

		ctxManager.addToConversationHistory(
			'CHATBOT',
			chatResponse.chatResponse.text
		);

		done();
	},
};
