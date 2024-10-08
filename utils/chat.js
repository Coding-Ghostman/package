const common = require('oci-common');
const fetch = require('node-fetch');
const { Headers } = fetch;

const configurationFilePath = '/home/fn/.oci/config';
const configProfile = 'DEFAULT';

const provider = new common.ConfigFileAuthenticationDetailsProvider(
	configurationFilePath,
	configProfile
);

async function chat(message, options = {}) {
	const {
		chatHistory = [],
		docs = [],
		maxTokens = 600,
		isStream = false,
		apiFormat = 'COHERE',
		frequencyPenalty = 1.0,
		presencePenalty = 0,
		temperature = 0,
		topP = 0.5,
		topK = 0.5,
		preambleOverride = '',
	} = options;

	// 1. Create Request Signing instance
	const signer = new common.DefaultRequestSigner(provider);

	// 2. Create HttpRequest to be signed
	const endpoint =
		'https://inference.generativeai.eu-frankfurt-1.oci.oraclecloud.com/20231130/actions/chat';

	const headers = new Headers({
		'Content-Type': 'application/json',
	});

	const body = JSON.stringify({
		compartmentId: provider.getTenantId(),
		servingMode: {
			modelId: 'cohere.command-r-plus',
			servingType: 'ON_DEMAND',
		},
		chatRequest: {
			message: message,
			maxTokens: maxTokens,
			isStream: isStream,
			apiFormat: apiFormat,
			frequencyPenalty: frequencyPenalty,
			preambleOverride: preambleOverride,
			presencePenalty: presencePenalty,
			temperature: temperature,
			topP: topP,
			topK: topK,
			documents: docs,
			chatHistory: chatHistory,
		},
	});

	const httpRequest = {
		uri: endpoint,
		headers: headers,
		method: 'POST',
		body: body,
	};
	// 3. sign request
	await signer.signHttpRequest(httpRequest);
	// 4. Make the call
	const response = await fetch(httpRequest.uri, {
		method: httpRequest.method,
		headers: httpRequest.headers,
		body: httpRequest.body,
	});

	// 5. Return response
	return await response.json();
}

module.exports = { chat };

// // Example usage
// async function example() {
// 	try {
// 		const message =
// 			"Tell me something about the company's relational database.";
// 		const chatHistory = [
// 			{ role: 'USER', message: 'Tell me something about Oracle.' },
// 			{
// 				role: 'CHATBOT',
// 				message:
// 					'Oracle is one of the largest vendors in the enterprise IT market and the shorthand name of its flagship product. The database software sits at the center of many corporate IT',
// 			},
// 		];

// 		const response = await chat(
// 			message,
// 			chatHistory,
// 			[],
// 			600,
// 			false,
// 			'COHERE',
// 			1.0,
// 			0,
// 			0.75,
// 			0.7,
// 			1
// 		);
// 		console.log(response);
// 	} catch (error) {
// 		console.error('Error:', error);
// 	}
// }

// // Run the example
// example();
