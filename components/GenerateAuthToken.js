'use strict';

const jwt = require('jsonwebtoken');

module.exports = {

  metadata: () => ({
    name: 'GenerateAuthToken',
    properties: {
      username: { required: true, type: 'string' },
      FAKey: { required: true, type: 'string' },
      issuer: { required: true, type: 'string' },
      thumbprint: { required: true, type: 'string' },
      responseVariableName: { required: true, type: 'string'},
    },

    supportedActions: ['success', 'failure']
  }),

  invoke: async (context) => {

    // Get the property values
    const { username, FAKey, issuer, thumbprint, responseVariableName } = context.properties();

    const payload = {
      "prn": username,
      "iss": issuer,
      "aud": context.variable("system.config.da.FARestEndPoint") + "/",
      "sub": username,
     };

/*  The key stored in the Skill's configuration parameter will have had it's newlines replaced with spaces.
    Here we convert them back to newlines so that it can be processed correctly. */
    const keyStartPhrase = "-----BEGIN RSA PRIVATE KEY-----";
    const keyEndPhrase = "-----END RSA PRIVATE KEY-----";
    const keyStartPos = keyStartPhrase.length;
    const keyEndPos = FAKey.indexOf(keyEndPhrase);
    let keyContents = FAKey.substring(keyStartPos,keyEndPos);
    keyContents = keyContents.replace(/\s/g,"\n");
    const finalKey = keyStartPhrase + keyContents + keyEndPhrase;

    let token;
    try {
      token = jwt.sign(payload, finalKey/*tempKey*/, {
        algorithm: 'RS256',
        expiresIn:  12 * 60 * 60,
        header: {"x5t": thumbprint}
      });
    }
    catch (err) {
      context.logger().info("Creating token failed with errror: " + err);
      context.keepTurn(true);
      context.transition('failure');
    }

    context.variable(responseVariableName, token);
    context.keepTurn(true);
    context.transition('success');
  }
};