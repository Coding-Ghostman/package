'use strict';

const axios = require('axios');

module.exports = {
	metadata: () => ({
		name: 'Custom.UserAuth',
		properties: {
			userId: { required: false, type: 'string' },
			oicUsername: { required: true, type: 'string' },
			oicPassword: { required: true, type: 'string' },
			fusionUsername: { required: true, type: 'string' },
			fusionPassword: { required: true, type: 'string' },
		},
		supportedActions: ['success', 'error'],
	}),

	invoke: async (context, done) => {
		let { userId, oicUsername, oicPassword, fusionUsername, fusionPassword } =
			context.properties();
		const logger = context.logger();
		
		if (userId.length > 6) {
			userId = 104608;
		}
		try {
			const oicAuth = Buffer.from(`${oicUsername}:${oicPassword}`).toString(
				'base64'
			);
			const fusionAuth = Buffer.from(
				`${fusionUsername}:${fusionPassword}`
			).toString('base64');

			const httpsAgent = new (require('https').Agent)({
				rejectUnauthorized: false,
			});

			const makeRequest = async (url, isOIC) => {
				return axios.get(url, {
					headers: { Authorization: `Basic ${isOIC ? oicAuth : fusionAuth}` },
					httpsAgent,
				});
			};

			const urls = {
				// leaveBalance: 'https://dmcc-dev1-axwzvekwq1qm-dx.integration.me-dubai-1.ocp.oraclecloud.com/ic/api/integration/v2/flows/rest/project/ODA_DEV/DMCC_LEAVE_BALANCES/1.0/leaveBalances',
				annualLeave:
					'https://emag-dev1.fa.em8.oraclecloud.com/hcmRestApi/resources/latest/planBalances',
				employee:
					'https://emag-dev1.fa.em8.oraclecloud.com/hcmRestApi/resources/latest/workers',
			};

			try {
				logger.info('Starting to get user data');
				logger.info('userId', userId);
				// First, get the employee data to extract the person ID
				const employeeResponse = await makeRequest(
					`${urls.employee}?onlyData=true&q=PersonNumber=${userId}&expand=religions,names,citizenships,workRelationships,workRelationships.assignments,citizenships,legislativeInfo`,
					false
				);
				const employeeData = employeeResponse.data.items[0];
				const personId = employeeData.PersonId;
				logger.info('personId', personId);
				// Now use the extracted person ID to make the other requests
				const [annualLeaveResponse] = await Promise.all([
					// makeRequest(`${urls.leaveBalance}?person_id=${personId}`, true),
					makeRequest(
						`${urls.annualLeave}?q=personId=${personId}&onlyData=true`,
						false
					),
				]);
				const userData = {
					personNumber: employeeData?.PersonNumber,
					personId: employeeData?.PersonId,
					dateOfBirth: employeeData?.DateOfBirth,
					gender: employeeData?.legislativeInfo[0]?.Gender,
					citizenship: employeeData?.citizenships[0]?.Citizenship,
					firstName: employeeData?.names[0]?.FirstName,
					lastName: employeeData?.names[0]?.LastName,
					fullName: employeeData.names[0].DisplayName,
					religion: employeeData?.religions[0]?.Religion,
					legalEntityId: employeeData?.workRelationships[0]?.LegalEntityId,
					grade: employeeData?.workRelationships[0]?.assignments[0]?.GradeCode,
					permanentTemporary:
						employeeData?.workRelationships[0]?.assignments[0]
							?.PermanentTemporary, // R is Permanent and T is temporary
					fullPartTime:
						employeeData?.workRelationships[0]?.assignments[0]?.FullPartTime,
					probationEndDate:
						employeeData?.workRelationships[0]?.assignments[0]
							?.ProbationEndDate,
					JobCode: employeeData?.workRelationships[0]?.assignments[0]?.JobCode,
					DepartmentName:
						employeeData?.workRelationships[0]?.assignments[0]?.DepartmentName,
					StartDate: employeeData?.workRelationships[0]?.StartDate,
					annualLeaveBalance: annualLeaveResponse.data?.items[0]?.balanceAsOfBalanceCalculationDate
				};

				// Store all user data under the user.profile key
				context.setVariable('user.profile', userData);

				logger.info('User data set:', JSON.stringify(userData, null, 2));
			} catch (error) {
				logger.error('Error in API requests:', error);
				throw error;
			}
			context.transition('success');
			done();
			return true;
		} catch (error) {
			logger.error('Error in Custom.CompareResumes:', error);
			if (error.response) {
				logger.error('Response data:', error.response.data);
				logger.error('Response status:', error.response.status);
				logger.error('Response headers:', error.response.headers);
				// context.variable('errorMessage', `API error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`);
			} else if (error.request) {
				logger.error('No response received:', error.request);
				// context.variable('errorMessage', 'No response received from the server');
			} else {
				logger.error('Error setting up request:', error.message);
				// context.variable('errorMessage', `Request setup error: ${error.message}`);
			}
			context.transition('error');
			done();
			return true;
		}
	},
};
