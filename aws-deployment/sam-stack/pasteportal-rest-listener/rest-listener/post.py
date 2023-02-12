import json
import logging
import os
import random
import sys
from datetime import datetime

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    """Lambda handler. This is the entry point for the lambda function.

    Args:
        event (string): the event as it was passed to the lambda function
        context (string): the context as it was passed to the lambda function

    Returns:
        string: the response to the request as a string in JSON format
    """
    return post_request(event, context)


def post_request(event, context):
    """Handles POST requests.

    Args:
        event (string): the event as it was passed to the lambda function
        context (string): the context as it was passed to the lambda function

    Returns:
        string: the response to the request
    """

    try:
        # Generates the id and timestamp
        id = hex(random.randint(0, 16777215))[2:].zfill(6)
        now = datetime.now()
        timestamp = now.isoformat()
        body = event["body"]
        table = os.environ["TABLE_NAME"]
        json_body = json.loads(body)
        if (
            ("paste" not in json_body)
            or ("creator_gh_user" not in json_body)
            or ("recipient_gh_username" not in json_body)
        ):
            return generate_response(
                400,
                "Missing required fields: paste, creator_gh_user, recipient_gh_username",
            )
        paste = json_body["paste"]
        creator_gh_user = json_body["creator_gh_user"]
        recipient_gh_username = json_body["recipient_gh_username"]

        db_input(table, id, paste, timestamp,
                 creator_gh_user, recipient_gh_username)
        message = {
            "message": "The paste was successfully inserted into the database",
            "id": str(id),
            "timestamp": str(timestamp),
            "raw_data": str(body),
            "paste": str(paste),
            "joke": generate_banter_comment(),
        }
        return generate_response(200, message)

    except Exception as e:
        print("Error: ", e)
        # return 500 with a message
        return generate_response(500, str(e))


def db_input(table_name, id, paste, timestamp, creator_gh_user, recipient_gh_username):
    """
    Insert data into the DynamoDB table with the given id and timestamp or generate a random id and timestamp if none are provided.
    The function also validate the table name and handle specific exception if table not found,
    and log the status of the function using AWS CloudWatch compatible logging.

    Args:
        table_name (str): The name of the DynamoDB table to insert the data into.
        id (str): The unique identifier of the data to insert. If not provided, a random id will be generated.
        paste (str): The data to insert into the DynamoDB table.
        timestamp (str): The timestamp of the data to insert into the DynamoDB table. If not provided, the current timestamp will be used.
        creator_gh_user (str): The username of the creator of the data.
        recipient_gh_username (str): The username of the recipient of the data.
    Returns:
        bool: True if the data was inserted successfully, False otherwise.
    """
    try:
        print("Inserting data into the table")
        print("Table name: ", table_name)
        print("Id: ", id)
        print("Paste: ", paste)
        print("Timestamp: ", timestamp)
        print("Creator GitHub Username: ", creator_gh_user)
        print("Recipient GitHub Username: ", recipient_gh_username)

        client = boto3.client("dynamodb")

        if id is None:
            id = hex(random.randint(0, 16777215))[2:].zfill(6)
        if timestamp is None:
            now = datetime.now()
            timestamp = now.isoformat()
        if table_name is None:
            table_name = os.environ["TABLE_NAME"]
        if paste is not None:
            paste = paste.replace("'", "''")
        dynamodb_data = client.put_item(
            TableName=str(table_name),
            Item={
                "id": {"S": str(id)},
                "timestamp": {"S": str(timestamp)},
                "creator_gh_user": {"S": str(creator_gh_user)},
                "recipient_gh_username": {"S": str(recipient_gh_username)},
                "paste": {"S": str(paste)},
            },
        )
        print("DynamoDB response: ", dynamodb_data)
        print("DynamoDB response metadata: ",
              dynamodb_data["ResponseMetadata"])
        print(
            "DynamoDB response metadata HTTP status code: ",
            dynamodb_data["ResponseMetadata"]["HTTPStatusCode"],
        )

        if (
            "ResponseMetadata" in dynamodb_data
            and dynamodb_data["ResponseMetadata"]["HTTPStatusCode"] == 200
        ):
            print("Record inserted successfully")
            return True
        else:
            print("Error: Could not insert record in DynamoDB")
            return False
    except client.exceptions.ResourceNotFoundException as e:
        logger.error(f"Error: The table {table_name} was not found.")
        logger.error(f"Error: {e}")
        return False
    except Exception as e:
        logger.error(f"Error: {e}")
        return False


def generate_banter_comment():
    """Generates a random banter comment.

    Returns:
        string: a random banter comment
    """

    comments = [
        "Debugging is like being a detective in a mystery movie where you're also the murderer.",
        "Why do programmers prefer dark mode? Less bright light when staring at their screen for hours.",
        "Debugging is like trying to find a needle in a haystack, except the needle is also made of hay.",
        "Why do developers always mix up Halloween and Christmas? Because Oct 31 equals Dec 25.",
        "Why was the JavaScript developer sad? He didn't know how to 'null'.",
        "Why do programmers always mix up Thanksgiving and Christmas? Because Nov 25 equals Dec 25.",
    ]
    return random.choice(comments)


def check_data_size(data):
    """Checks the size of the data to ensure it is bellow 400kb which is the limit for DynamoDB

    Args:
        data (string): Incoming data

    Returns:
        String: JSon Return
    """

    # Size limit in bytes
    size_limit = 400 * 1024

    # Check if the data is larger than the size limit
    if sys.getsizeof(data) > size_limit:
        print("Size is not within the limit" + str(sys.getsizeof(data)))
        return {
            "statusCode": 500,
            "body": json.dumps(
                {
                    "message": "That was a big one. Try to send a smaller one just in case.",
                    "joke": generate_banter_comment(),
                }
            ),
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        }
        # exit compltely

    else:
        print("Data size is within limit:" + str(sys.getsizeof(data)))


def generate_response(status_code, message, data=None):
    """Generates a consistent JSON response for the client.

    Args:
        status_code (int): the HTTP status code of the response
        message (string): the message to be included in the response

    Returns:
        dict: the JSON response
    """
    try:
        if not isinstance(status_code, int) or not 100 <= status_code <= 599:
            raise ValueError("Invalid status code")
        if not isinstance(message, dict):
            raise ValueError("Invalid message")

        response = {
            "statusCode": status_code,
            "body": json.dumps({"response": message}),
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Secret": "Writen by ChatGPT-3",
            },
        }
        return response
    except ValueError as e:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": str(e)}),
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Secret": "Writen by ChatGPT-3",
            },
        }
