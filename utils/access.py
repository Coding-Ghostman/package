# coding: utf-8
# Copyright (c) 2016, 2020, Oracle and/or its affiliates.  All rights reserved.
# This software is dual-licensed to you under the Universal Permissive License (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl
# or Apache License 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose either license.

import requests
from oci.config import from_file
from oci.signer import Signer

config = from_file(file_location="~/.oci_dmcc/config", profile_name="DEFAULT")
auth = Signer(
    tenancy=config["tenancy"],
    user=config["user"],
    fingerprint=config["fingerprint"],
    private_key_file_location=config["key_file"],
    pass_phrase=config["pass_phrase"],
)
print(config)
endpoint = "https://inference.generativeai.eu-frankfurt-1.oci.oraclecloud.com/20231130/actions/chat"

body = {
    "compartmentId": config["tenancy"],
    "servingMode": {"modelId": "cohere.command-r-16k", "servingType": "ON_DEMAND"},
    "chatRequest": {
        "message": "Tell me something about the company's relational database.",
        "maxTokens": 600,
        "isStream": False,
        "apiFormat": "COHERE",
        "frequencyPenalty": 1.0,
        "presencePenalty": 0,
        "temperature": 0.75,
        "topP": 0.7,
        "topK": 1,
        "documents": [
            {
                "title": "Oracle",
                "snippet": "Oracle database services and products offer customers cost-optimized and high-performance versions of Oracle Database, the world's leading converged, multi-model database management system, as well as in-memory, NoSQL and MySQL databases. Oracle Autonomous Database, available on premises via Oracle Cloud@Customer or in the Oracle Cloud Infrastructure, enables customers to simplify relational database environments and reduce management workloads.",
                "website": "https://www.oracle.com/database",
            }
        ],
        "chatHistory": [
            {"role": "USER", "message": "Tell me something about Oracle."},
            {
                "role": "CHATBOT",
                "message": "Oracle is one of the largest vendors in the enterprise IT market and the shorthand name of its flagship product. The database software sits at the center of many corporate IT",
            },
        ],
    },
}
print(body)
response = requests.post(endpoint, json=body, auth=auth)
response.raise_for_status()

print(response.json())
