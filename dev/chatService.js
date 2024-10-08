const { generateOCISignature } = require('./auth');
const fetch = require('node-fetch');

async function chatService(
	message,
	chatHistory = [],
	docs = [],
	maxTokens = 600
) {
	const params = {
		tenancyOcid:
			'ocid1.tenancy.oc1..aaaaaaaahqvb2kliqi35z57qalhpr4dyqbjprclszdcoar2wgc7q6nl36aba',
		userOcid:
			'ocid1.user.oc1..aaaaaaaahty62xsrdprkvss3tw7rytnkepywqqwmfy5gpvqnrbu3w5napakq',
		fingerprint: '4f:73:c3:a0:86:cf:f3:57:3d:1b:1b:ff:98:cf:e4:d4',
		privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDfZhZHtI2OjMt0
+FqzjzrNdH2X+Cbw7g3OrsFJ+x+pQ43WDgFZzqNgltVgGfSp89q01GQ5uxDMFbpH
vkUsQ2azlrxAyISsCq7tYxa4afHW7UbCAgZd1toakXR1RbSqC1zRqxuiGS4YvuRp
m8fDjogtRrNi/Q9SOvjpxqYRUPpcwdIR74oPJSDeR+bKeycX5Vd0aX4oJeXmrviD
1GvwYBuxr0CEEtEVBr1zrAfTPsYv+qHnpdFpHsaxpKVIocIGAfTU7baS0/cDVzkb
SA8yZcbKCeWcAM5huMWHh/PvkvgCY1WhY18QoVjx4p2WXd0t8q/rWS0TyEG1ukoV
u7QZXv/lAgMBAAECggEABugu3aovKz5epv/ru/v8bzBAFtQBDjdp/V8pUjp9rNvO
FZVqxMZPBlQ7hiRfTGbh9u/PJnrKZujwELpJBLiTww8wxFb+xRvycxv6bpq187Vz
19k8raeQKDyhi2OrlYtS5Beke9NH+dNjGAHNQBZWzwGN18xnrhztJ7sw1L26c+Yq
ZoN4/u0dxdUTxLXvb4FsPULsuwYxkwgCZ4g+6S7I3KA+wxdX8VQAFt+NDXn/MvET
SOHR9vtipMa5bS2gfqjmM9IibKhtsjaKVpujaiB1aLKK1OEWooMVAQCmof3dNaUl
jjNCUq9v1vI0Z+Ynx1lAm5fhsVQ1LH5NOxu5iI4AmQKBgQD4L9aZHtS0WAAuyvui
C88P1mKLz89mycX5mCd8vJkRlCeIABVdqM2v8UbU6QtbKGJMUUprIJO7BUcBdLSu
+vIoFV0DM05M1ejE/bYoQwyrGjvOiM6VFOM52Dz5KHtvOrNBLC824cMax2IOsWm7
SW1ujRiq1QlF9BEfakjYv0TwaQKBgQDmbnqqU5KyVbh/ZGNLoeIR1emi6gT+X7Po
pcogY8tUWjlO6h+/lcvnZtXHXOm1ArI8xDzH8GAi/plv6ecdTciXj+xk0JXCm1Gk
I2J1ObdaxlTkpJgVyRBbEGYH/nYroiagVmZX4lXaj3GS5IDzDQps0VGvy9nMkvL0
GfjC3pkkHQKBgGhhXkT55YWPuUv0zM4DX2uOw9V/agAV/nCR4JGilFIDWHjnaBUD
CLblp9+lv8PwAR+N1NmnUtqGRq3DErbBDhVznrHY4yaHlKU8+16FjI9tsheUDCZB
KavLWSGFOBy4uGlBlv3jB3Z8wq3hSdGd+StUpjo67PKByq3GuqqGDw15AoGBAN6s
1mbwGeuxwHeCqB23UwJPR9ZB9Q9npjBkvb2tEhjykzy6LHH0LLXx/xYHqGReNaVZ
MS85D33hsJ6gVtFPkE8+Kn+FvaLweuV1uDh1zMSwseq9T6aFxQNrBl4lPUaPDGqW
85Fry/FH+sWrgRzedjuPzzNld5QkURkoW+bcOvrVAoGBAMATkgtJSXHbX2sPrNtS
P7QNQLJo4e862ZXUwwDIJgKjl7w4u+6rEJk2tx5mGogA/u526LLCOVdSp/4bMLXj
ygQg3zzgJv1DvPySdws3QxiY07pG83vaUNDt6MD+TKjwE1TJadyATz3w6nMLXljN
cbKP26vur8aj+9ZGZZd2V489
-----END PRIVATE KEY-----
OCI_API_KEY`,
		passphrase: '',
		region: 'me-dubai-1',
		requestUrl:
			'https://inference.generativeai.eu-frankfurt-1.oci.oraclecloud.com/20231130/actions/chat',
		requestMethod: 'POST',
		headers: { 'content-type': 'application/json' },
	};

	const body = JSON.stringify({
		compartmentId: params.tenancyOcid,
		servingMode: {
			modelId: 'cohere.command-r-plus',
			servingType: 'ON_DEMAND',
		},
		chatRequest: {
			message,
			maxTokens,
			isStream: false,
			apiFormat: 'COHERE',
			frequencyPenalty: 1.0,
			presencePenalty: 0,
			temperature: 0.75,
			topP: 0.7,
			topK: 1,
			documents: docs,
			chatHistory,
		},
	});

	params.requestBody = body;

	const { authorizationHeader } = generateOCISignature(params);

	console.log('authorizationHeader', authorizationHeader);

	const response = await fetch(params.requestUrl, {
		method: params.requestMethod,
		headers: {
			'Content-Type': 'application/json',
			Authorization: authorizationHeader,
		},
		body,
	});

	return await response.json();
}

module.exports = { chatService };

// Example usage
async function example() {
	try {
		const message =
			"Tell me something about the company's relational database.";
		const chatHistory = [
			{ role: 'USER', message: 'Tell me something about Oracle.' },
			{
				role: 'CHATBOT',
				message:
					'Oracle is one of the largest vendors in the enterprise IT market...',
			},
		];

		const response = await chatService(message, chatHistory);
		console.log(response);
	} catch (error) {
		console.error('Error:', error);
	}
}

example();
