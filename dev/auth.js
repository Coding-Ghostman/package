const { KJUR } = require('jsrsasign'); // Ensure you have jsrsasign installed
var CryptoJS = require('crypto-js');
function generateOCISignature({
	tenancyOcid,
	userOcid,
	fingerprint,
	privateKey,
	passphrase,
	region,
	requestUrl,
	requestMethod,
	requestBody,
	headers = {},
}) {
	// Check if it's an Oracle Cloud domain
	if (!requestUrl.includes('oraclecloud.com')) {
		throw new Error('Not an Oracle Cloud domain.');
	}

	// Construct API Key ID
	const apiKeyId = `${tenancyOcid}/${userOcid}/${fingerprint}`;
	const rawClusterUrl = `https://containerengine.${region}.oraclecloud.com/cluster_request`;

	// Resolve host and paths
	const url = new URL(requestUrl);
	const host = url.hostname;
	let pathWithQuery = url.pathname + url.search;
	if (pathWithQuery.endsWith('?')) {
		pathWithQuery = pathWithQuery.slice(0, -1);
	}

	// Current date
	const currentDate = new Date().toUTCString();

	// Add Date header
	headers['Date'] = currentDate;

	// Create the signing string
	const requestTargetHeader = `(request-target): ${requestMethod.toLowerCase()} ${encodeURI(
		pathWithQuery
	)}`;
	const hostHeader = `host: ${host}`;
	const dateHeader = `date: ${currentDate}`;

	let signingStringArray = [requestTargetHeader, dateHeader, hostHeader];
	let headersToSign = ['(request-target)', 'date', 'host'];

	// Handle requests with body (POST, PUT, PATCH)
	const methodsThatRequireExtraHeaders = ['POST', 'PUT', 'PATCH'];
	const isBodyRequired = methodsThatRequireExtraHeaders.includes(
		requestMethod.toUpperCase()
	);

	if (
		isBodyRequired &&
		!(requestMethod.toUpperCase() === 'PUT' && pathWithQuery.startsWith('/n/'))
	) {
		const body = requestBody || '';
		const contentLengthHeader = `content-length: ${Buffer.byteLength(body)}`;
		const contentTypeHeader = `content-type: ${
			headers['content-type'] || 'application/json'
		}`;

		const bodyHash = new KJUR.crypto.MessageDigest({
			alg: 'sha256',
			prov: 'cryptojs',
		});
		bodyHash.updateString(body);
		const base64EncodedBodyHash = Buffer.from(
			bodyHash.digest(),
			'hex'
		).toString('base64');
		const contentSha256Header = `x-content-sha256: ${base64EncodedBodyHash}`;

		// Update headers and signing string
		signingStringArray.push(
			contentSha256Header,
			contentTypeHeader,
			contentLengthHeader
		);
		headersToSign.push('x-content-sha256', 'content-type', 'content-length');
	}

	// Joins
	const headersString = headersToSign.join(' ');
	const signingString = signingStringArray.join('\n');

	// Generate OCI Signature for Authorization
	const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
	sig.init(privateKey, passphrase);
	sig.updateString(signingString);
	const base64EncodedSignature = Buffer.from(sig.sign(), 'hex').toString(
		'base64'
	);

	const authorizationHeader = `Signature version="1",keyId="${apiKeyId}",algorithm="rsa-sha256",headers="${headersString}",signature="${base64EncodedSignature}"`;

	return {
		authorizationHeader,
		kubeOkeToken:
			requestMethod === 'GET'
				? null
				: CryptoJS.enc.Base64.stringify(
						CryptoJS.enc.Utf8.parse(
							`${rawClusterUrl}?authorization=${encodeURIComponent(
								authorizationHeader
							)}&date=${encodeURIComponent(currentDate)}`
						)
				  ),
	};
}

module.exports = {
	generateOCISignature,
};

// Example usage
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
	requestMethod: 'POST', // or 'GET', 'PUT', etc.
	requestBody: 'your-request-body', // optional, only for methods that require a body
	headers: { 'content-type': 'application/json' }, // optional headers
};

const { authorizationHeader, kubeOkeToken } = generateOCISignature(params);
console.log('Authorization Header: ', authorizationHeader);
console.log('Kube OKE Token: ', kubeOkeToken);
