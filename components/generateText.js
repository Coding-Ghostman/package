const jsrsasign = require('jsrsasign');

module.exports = {
	metadata: {
		name: 'CUSTOM_Check_GenAi',
		properties: {},
		supportedActions: [],
	},
	invoke: async (context, done) => {
		const logger = context.logger();
		const baseURL = context.variable('skill.config.baseURL');
		const tenancyOcid = context.variable('skill.config.tenancyOcid');
		const userOcid = context.variable('skill.config.userOcid');
		const fingerprint = context.variable('skill.config.fingerprint');
		const privateKey = context.variable('skill.config.privateKey');
		const passphrase = context.variable('skill.config.passphrase');
		const region = context.variable('skill.config.region');
		const compartmentOcid = context.variable('skill.config.compartmentOcid');
		const vcnOcid = context.variable('skill.config.vcnOcid');
		const subnetOcid = context.variable('skill.config.subnetOcid');

		// Check if the URL includes "oraclecloud.com"
		if (!baseURL.includes('oraclecloud.com')) {
			logger.info('URL does not include oraclecloud.com');
			done();
			return;
		}

		// Check OCI Credentials variables
		if (!tenancyOcid) {
			throw new Error('Tenancy OCID (tenancyOcid) Variable Not Set');
		}
		if (!userOcid) {
			throw new Error('User OCID (userOcid) Variable Not Set');
		}
		if (!fingerprint) {
			throw new Error('Key Fingerprint (fingerprint) Variable Not Set');
		}
		if (!privateKey) {
			throw new Error('Private Key (privateKey) Variable Not Set');
		}
		if (!region) {
			throw new Error('OCI Region (region) Variable Not Set');
		}

		// You'll need to include the jsrsasign library here
		//

		// Const Variables
		const apiKeyId = `${tenancyOcid}/${userOcid}/${fingerprint}`;
		const rawClusterUrl = `https://containerengine.${region}.oraclecloud.com/cluster_request/{{cluster_ocid}}`;

		// Example of how you might structure the authorizationString function:
    const authorizationString = (type) => {
      
		};

		logger.info('Authorization header set successfully');
		done();
	},
};
