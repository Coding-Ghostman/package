const axios = require('axios');

async function submitLeaveRequest(requestBody, auth) {
	const apiUrl =
		process.env.HRMS_API_URL ||
		'https://emag-dev1.fa.em8.oraclecloud.com/hcmRestApi/resources/11.13.18.05/absences';

	try {
		const response = await axios.post(apiUrl, requestBody, {
			auth: {
				username: auth.username,
				password: auth.password,
			},
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (response.status === 200 || response.status === 201) {
			return {
				success: true,
				data: response.data,
			};
		} else {
			throw new Error(`Request failed with status code ${response.status}`);
		}
	} catch (error) {
		console.error('Error submitting leave request:', error.message);
		return {
			success: false,
			error: error.message,
		};
	}
}

module.exports = { submitLeaveRequest };
