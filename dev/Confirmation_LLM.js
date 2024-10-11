const { chat } = require('../utils/chat');
const ContextManager = require('../components/ContextManager');
const moment = require('moment');

module.exports = {
	metadata: {
		name: 'confirmation_v2',
		properties: {},
		supportedActions: ['router', 'cancel'],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		logger.info('Confirmation_LLM: Invoking');

		const ctxManager = new ContextManager(context);
		const userMessage = ctxManager.getUserMessage();
		const extractedInfo = ctxManager.getExtractedInfo();
		console.log('Confirmation_LLM: Extracted Info:', extractedInfo);
		console.log('Confirmation_LLM: User Message:', userMessage);

		// Format dates
		const formatDate = (dateString) => {
			const date = moment(dateString);
			return `${date.format('Do MMMM')} (${date.format('dddd')})`;
		};

		const formattedStartDate = formatDate(extractedInfo.startDate);
		const formattedEndDate = formatDate(extractedInfo.endDate);

		const confirmationPreambleOverride = `
You are an AI assistant for an HRMS Leave Management system. Your task is to generate a confirmation message for the user's leave request and ask for their final approval. Make the message conversational and natural, as if a human HR representative is speaking. Avoid using bullet points or formal structures. The tone should be friendly yet professional.

Instructions:
1. Summarize the leave request details (leave type, start date, end date, and day types if applicable) in a conversational manner.
2. Use the provided formatted dates when mentioning start and end dates.
3. Ask the user to confirm if the details are correct.
4. Casually mention options for the user to confirm, make changes, or cancel the request.
5. Keep the overall tone warm and approachable.
6. Try to keep your response within 30 words max. You have to keep your prompt short and concise.
7. If the user is trying to modify an existing parameter, acknowledge the change and ask for confirmation.
8. Use a natural, conversational tone similar to: "So, I'm booking your leave from ${formattedStartDate} to ${formattedEndDate}. Both are full days. Does this look good to you?"

`.replace(/\\t/g, '');

		const prompt = `
Extracted Info: ${JSON.stringify(extractedInfo)}
User Message: ${userMessage}
Formatted Start Date: ${formattedStartDate}
Formatted End Date: ${formattedEndDate}

Generate a confirmation message for the leave request based on the extracted information and conversation history. 
Keep the message conversational and natural, as if a human HR representative is speaking. 
Avoid using bullet points or formal structures. 
The tone should be friendly yet professional. 
Answer in a brief format for up to 30 words.
Use the provided formatted dates when mentioning start and end dates.
Generate a brief, friendly prompt based on the current leave request context.
`.replace(/\\t/g, '');

		const chatResponse = await chat(prompt, {
			maxTokens: 200,
			temperature: 0.7,
			preambleOverride: confirmationPreambleOverride,
			chatHistory: ctxManager.getConversationHistory(),
		});

		logger.info(
			'Confirmation_LLM: Generated confirmation',
			chatResponse.chatResponse.text
		);
		ctxManager.setTestResponse(chatResponse.chatResponse.text);
		ctxManager.reply(chatResponse.chatResponse.text);

		// Transition based on user's response
		if (
			userMessage.toLowerCase().includes('confirm') ||
			userMessage.toLowerCase().includes('yes')
		) {
			// Here you would typically save the leave request to your database
			// ctxManager.reply(
			// 	'Great! Your leave request has been confirmed and saved. Is there anything else I can help you with?'
			// );
			ctxManager.transition('router');
		} else if (
			userMessage.toLowerCase().includes('change') ||
			userMessage.toLowerCase().includes('edit')
		) {
			ctxManager.transition('router');
		} else if (userMessage.toLowerCase().includes('cancel')) {
			ctxManager.transition('cancel');
		} else {
			ctxManager.transition('router');
		}

		ctxManager.addToConversationHistory(
			'CHATBOT',
			chatResponse.chatResponse.text
		);

		done();
	},
};
