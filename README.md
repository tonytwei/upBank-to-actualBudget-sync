# Up Bank to Actual Budget Sync

This project syncs transactions from Up Bank to Actual Budget using an AWS Lambda function.

## Prerequisites

1. **AWS Account**: Ensure you have an AWS account with permissions to create Lambda functions and API Gateway resources.
2. **Up Bank API Key**: Obtain your API key from [UpBank](https://api.up.com.au/getting_started).
3. **Actual Budget Server**: Set up an ActualBudget server and obtain the necessary credentials.

## Setup Instructions

### 1. Clone the Repository

```
git clone https://github.com/your-repo/upBank-to-actualBudget-sync.git
cd upBank-to-actualBudget-sync
```
### 2. Configure Environment Variables
Rename .env.example to .env:

Edit the .env file and fill in the required values:

### 3. Create an AWS Lambda Function
Zip the Repository: Exclude unnecessary files (e.g., node_modules and .git) and zip the repository:

Upload to AWS Lambda:

Go to the AWS Lambda Console.
Create a new function.
Choose "Upload a .zip file" and upload function.zip.
Set the runtime to Node.js 22.x.
Set the handler to lambda.handler.
Update Lambda Environment Variables:

Add the variables from your .env file to the Lambda function's environment variables.
Increase Timeout:

Update the Lambda function's timeout to 1 minute (default is 3 seconds).
### 4. Create an API Gateway
Create a New API:

Go to the API Gateway Console.
Create a new HTTP API.
Add a Route:

Add a route (e.g., /up-to-actual-budget).
Integrate the route with your Lambda function.
Deploy the API:

Deploy the API and note the endpoint URL (e.g., https://xxxx.execute-api.us-east-1.amazonaws.com/up-to-actual-budget).
### 5. Create a Webhook on UpBank
Use the following command to create a webhook:

Replace <UP_BANK_ACCESS_TOKEN> with your UpBank API key and https://xxxx.execute-api.us-east-1.amazonaws.com/up-to-actual-budget with your API Gateway URL.

### 6. Test the Setup
Trigger a transaction in UpBank.
Check the AWS Lambda logs to ensure the transaction is processed and synced to ActualBudget.
Notes
Ensure your Lambda function has internet access to connect to the UpBank and ActualBudget APIs.
Use AWS CloudWatch to debug any issues with the Lambda function.
## License
This project is licensed under the MIT License. See the LICENSE file for details. ```