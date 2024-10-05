'use strict';

// Documentation for writing LLM Transformation handlers: https://github.com/oracle/bots-node-sdk/blob/master/LLM_TRANSFORMATION_HANDLER.md

// You can use your favorite http client package to make REST calls, however, the node fetch API is pre-installed with the bots-node-sdk.
// Documentation can be found at https://www.npmjs.com/package/node-fetch
// Un-comment the next line if you want to make REST calls using node-fetch.
// const fetch = require("node-fetch");

module.exports = {
	metadata: {
		name: 'CC_OCI_CommandR',
		eventHandlerType: 'LlmTransformation',
	},
	handlers: {
		/**
		 * Handler to transform the request payload
		 * @param {TransformPayloadEvent} event - event object contains the following properties:
		 * - payload: the request payload object
		 * @param {LlmTransformationContext} context - see https://oracle.github.io/bots-node-sdk/LlmTransformationContext.html
		 * @returns {object} the transformed request payload
		 */
		transformRequestPayload: async (event, context) => {
			// NOTE: Depending on the Cohere version, this code might need to be updated
			let messages = event.payload.messages;
			console.log('*' * 100);
			console.log('messages', messages);
			console.log('*' * 100);
			//get the last element in the message payload as the message to get an LLM answer for
			let prompt = messages[messages.length - 1].content;
			//remove the last element as it should no be part of the chat history
			messages.pop();
			//create a chat history from the messages in the prompt
			let chatHistory = messages.map((item) => {
				let role = '';
				if (item.role === 'assistant') {
					role = 'CHATBOT';
				} else {
					role = item.role;
				}
				return { message: item.content, role: role.toUpperCase() };
			});
			console.log('*' * 100);
			console.log('chatHistory', chatHistory);
			console.log('*' * 100);

			// ChatHistory attribute in genai chat not expecting given chathistory from ODA. Temporary fix by appending chatHistory to prompt.
			//if (messages.length > 1){
			//let history = messages.slice(1).reduce((acc, cur) => `${acc}\n${cur.role}: ${cur.content}` , '');
			//prompt += `\n\nCONVERSATION HISTORY:${history}\nassistant:`
			//}
			return {
				compartmentId: event.compartmentId,
				servingMode: {
					modelId:
						'ocid1.generativeaimodel.oc1.eu-frankfurt-1.amaaaaaask7dceyaazssnpqc7g4rxwlvcfehpcfbtdvvkftz3jzz5pf4tenq',
					servingType: 'ON_DEMAND',
				},
				chatRequest: {
					apiFormat: 'COHERE',
					message: prompt,
					maxTokens: 1200,
					temperature: 0.8,
					// isStream: true,
					chatHistory: chatHistory,
				},
			};
		},

		/**
		 * Handler to transform the response payload
		 * @param {TransformPayloadEvent} event - event object contains the following properties:
		 * - payload: the response payload object
		 * @param {LlmTransformationContext} context - see https://oracle.github.io/bots-node-sdk/LlmTransformationContext.html
		 * @returns {object} the transformed response payload
		 */
		transformResponsePayload: async (event, context) => {
			let llmPayload = {};
			llmPayload.candidates = [{ content: event.payload.chatResponse.text }];
			return llmPayload;
			// return event.payload.chatResponse.text;
		},

		/**
		 * Handler to transform the error response payload, invoked when HTTP status code is 400 or higher and the error
		 * response body received is a JSON object
		 * @param {TransformPayloadEvent} event - event object contains the following properties:
		 * - payload: the error response payload object
		 * @param {LlmTransformationContext} context - see https://oracle.github.io/bots-node-sdk/LlmTransformationContext.html
		 * @returns {object} the transformed error response payload
		 */
		transformErrorResponsePayload: async (event, context) => {
			// NOTE: Depending on the Cohere version, this code might need to be updated
			const error = event.payload.message || 'unknown error';
			if (error.startsWith('invalid request: total number of tokens')) {
				// returning modelLengthExceeded error code will cause a retry with reduced chat history
				return { errorCode: 'modelLengthExceeded', errorMessage: error };
			} else {
				return { errorCode: 'unknown', errorMessage: error };
			}
		},
	},
};
