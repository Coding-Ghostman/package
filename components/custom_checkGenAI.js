const genai = require('oci-generativeaiinference');
const common = require('oci-common');
const conversationHistory = require('../utils/conversationHistory');

// Configs
// const configFile = '~/.oci_conn/config';
// const configProfile = 'DEFAULT';
// const authenticationProvider =
// 	new common.ConfigFileAuthenticationDetailsProvider(configFile, configProfile);
// const compartmentId =
// 	'ocid1.tenancy.oc1..aaaaaaaahqvb2kliqi35z57qalhpr4dyqbjprclszdcoar2wgc7q6nl36aba';

const compartmentId =
	'ocid1.compartment.oc1..aaaaaaaacdv3ig7yho6ebvdm6p5cdxq74pgnugeankt25mebpxoyhar2n4pa';

async function generateAIResponse(
	userMessage,
	preambleOverride = '',
	logger,
	context
) {
	const authenticationProvider =
		common.ResourcePrincipalAuthenticationDetailsProvider.builder();
	const client = new genai.GenerativeAiInferenceClient({
		authenticationDetailsProvider: authenticationProvider,
	});
	try {
		const modelId = 'cohere.command-r-plus';
		// const modelId = 'ocid1.generativeaimodel.oc1.eu-frankfurt-1.amaaaaaask7dceyaazssnpqc7g4rxwlvcfehpcfbtdvvkftz3jzz5pf4tenq';
		const prompt = userMessage;
		const conversationHistory = context.variable('user.conversationHistory');
		const max_tokens = 600;
		const temperature = 0;
		const top_k = 0.5;
		const docs = [
			{
				title: 'Sick Leave',
				snippet:
					'Used if the employee is unable to attend work due to a medical reason, such as they are ill, or have to attend a medical appointment',
			},
			{
				title: 'Annual Leave',
				snippet:
					'The employee is entitled to take 20 days annual leave at their discretion without giving a particular reason. The purpose is simply to give them a break from work. This time might also be referred to as vacation, Personal Time Off (PTO), or annual leave.',
			},
			{
				title: 'Remote Working',
				snippet:
					'Used if the employee wishes to have some time working outside of the office - for example working from home, or another remote location.',
			},
		];
		const serving_mode = {
			modelId: modelId,
			servingType: 'ON_DEMAND',
		};

		const inference_request = {
			message: prompt,
			apiFormat: 'COHERE',
			citationQuality: 'ACCURATE',
			maxTokens: max_tokens,
			preambleOverride: preambleOverride,
			temperature: temperature,
			documents: docs,
			chatHistory: conversationHistory,
			topK: top_k,
		};

		const chatDetails = {
			compartmentId: compartmentId,
			servingMode: serving_mode,
			chatRequest: inference_request,
		};

		logger.info('CUSTOM_Check_GenAi: ', chatDetails);
		const chatResponse = await client.chat({ chatDetails: chatDetails });
		return chatResponse;
	} catch (error) {
		logger.error('chat Failed with error  ' + error);
		throw error;
	}
}

module.exports = {
	metadata: {
		name: 'CUSTOM_Check_GenAi',
		properties: {},
		supportedActions: [],
	},
	invoke: async (context, done) => {
		// const authenticationProvider = await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build();

		const logger = context.logger();
		let History = context.variable('user.conversationHistory');

		if (History === null || History === undefined) {
			conversationHistory.storeConversationHistory(
				context,
				'SYSTEM',
				`## Instructions
			You are an intelligent routing agent designed to assist employees in booking time off work. Your primary goal is to determine the appropriate Absence Plan for each request and guide the conversation to gather all necessary information. If the user is not asking for a leave, you have to respond the user in a way that they will ask for a leave. Follow these steps:

			1. Analyze the conversation log and the user's latest query.
			2. Determine if there's enough information to unambiguously identify the appropriate Absence Plan.
			3. If the information is sufficient, select the appropriate Absence Plan.
			4. If the information is insufficient or ambiguous:
				a. Identify what additional information is needed.
				b. Formulate a short question just like a human asking the user for information. Don't explicitly mention, any leave type unless, you have an idea about the leave type from user query.
				c. Provide relevant context from the available Absence Plans to help the user.
			5. Always maintain a helpful and professional tone and don't explicitly mention any leave types. Just ask the user in a very general and friendly tone.

			## Response Format
			Provide your response in the following JSON format with no markdown, NO additional formatting, no backticks:

			{
				"hasEnoughInfo": boolean,
				"selectedPlan": string | null,
				"needMoreInfo": boolean,
				"questionToAsk": string | null,
				"explanation": string
			}`.replace(/\t/g, '')
			);
		}

		const userMessage = context.getUserMessage();
		const preambleOverride = `You are an intelligent routing agent designed to assist employees in booking time off work. You have to provide your response always in json Format. Follow the given instructions properly`;

		conversationHistory.storeConversationHistory(
			context,
			'USER',
			userMessage.text
		);

		try {
			const chatResponse = await generateAIResponse(
				userMessage.text,
				preambleOverride,
				logger,
				context
			);
			conversationHistory.storeConversationHistory(
				context,
				'CHATBOT',
				chatResponse.chatResult.chatResponse.text
			);
			let response = JSON.parse(
				chatResponse.chatResult.chatResponse.text
					.replace(/`/g, '')
					.replace('json', '')
					.trim()
			);
			console.log(response);
			History = context.variable('user.conversationHistory');
			console.log(History);
			if (response.hasEnoughInfo && !response.needMoreInfo) {
				context.reply(response.selectedPlan);
			} else {
				context.reply(response.questionToAsk);
			}
		} catch (error) {
			logger.error('chat Failed with error  ' + error);
		}
		context.transition();
		done();
	},
};
