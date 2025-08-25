
// This file is used to import the service account key.
// It is used by the Genkit initialization code in src/ai/genkit.ts.
// It is important that this file is not imported into any client-side code.

import serviceAccountJson from '../../key.json';

// Define the type for the service account object
interface ServiceAccount {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain: string;
}

export const serviceAccount: ServiceAccount = serviceAccountJson;
