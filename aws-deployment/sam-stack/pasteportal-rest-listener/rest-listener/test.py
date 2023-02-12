import json

import boto3

client = boto3.client("dynamodb")


def lambda_handler(event, context):
    data = client.get_item(TableName="pasteportal", Key={"id": {"S": "12345"}})

    print(data)

    response = {
        "statusCode": 200,
        "body": json.dumps(data),
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    }

    return response
