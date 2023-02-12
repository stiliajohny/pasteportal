import json
import logging
import os
import random
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
    return get_request(event, context)


def get_request(event, context):
    """Handles GET requests.

    Args:
        event (string): the event as it was passed to the lambda function
        context (string): the context as it was passed to the lambda function

    Returns:
        string: the response to the request
    """

    # Gather some Vvariables
    body = event
    queryStringParameters = body["queryStringParameters"]
    queryStringParameters = {
        k.lower(): v for k, v in queryStringParameters.items()}
    first_queryStringParameters_key = list(queryStringParameters.keys())[0]
    table_name = os.environ["TABLE_NAME"]
    # if the table name is not configured return a 500 with a message

    # check if the first key is data and if the length of the dictionary is 1 if is not return a 400 with a message
    if first_queryStringParameters_key != "id" or len(queryStringParameters) != 1:
        message = {
            "message": "The paste was unsuccessfully retrived from the database. Parameter is not correct",
            "joke": generate_banter_comment(),
        }
        logger.info(message)
        return generate_response(400, message)
    else:
        id = queryStringParameters["id"]
        returned_data = db_output(table_name, id)
        # if the reposne is None return a 404 with a message
        # alternatively you can return a 200 with a message that says the paste was not found
        if returned_data is None:
            message = {
                "message": "The paste was unsuccessfully retrived from the database",
                "id": "Not Found",
                "joke": generate_banter_comment(),
            }
            logger.info(message)
            return generate_response(400, message)
        else:

            id = returned_data["id"]
            paste = returned_data["paste"]
            timestamp = returned_data["timestamp"]
            creator_gh_user = returned_data["creator_gh_user"]
            recipient_gh_username = returned_data["recipient_gh_username"]

            message = {
                "message": "The paste was successfully retrived from the database",
                "id": str(id),
                "paste": str(paste),
                "joke": generate_banter_comment(),
                "creator_gh_user": str(creator_gh_user),
                "recipient_gh_username": str(recipient_gh_username),
            }
            logger.info(message)
            return generate_response(200, message)


def db_output(table_name, id):
    """Get data from the database and return it as a string or None if no data was found for the given id

    Args:
        table_name (string): the name of the table to get the data from
        id (string): the id of the data to get

    Returns:
        result: the data as a string or None if no data was found for the given id
    """
    try:
        client = boto3.client("dynamodb")
        response = client.get_item(TableName=table_name, Key={
                                   "id": {"S": str(id)}})
        # Check if the response was successful
        if "Item" not in response:
            raise ValueError("No item found for the provided id.")
        item_values = export_item_values(response["Item"])
        return item_values
    except ValueError as e:
        print(e)
        return None
    except Exception as e:
        print(e)
        return None


def export_item_values(item):
    """
    Takes in an 'item' (a dictionary) and returns a new dictionary where the values of the original item are the values of the new dictionary and the keys are the same as in the original item.

    Args:
        item (dict): The original dictionary
    Returns:
        dict: New dictionary with same keys and values of the original item
    """
    item_dict = {}
    for key, value in item.items():
        item_dict[key] = value["S"]
    return item_dict


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
                "Access-Control-Allow-Origin": "'127.0.0.1'",
                "Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                "Access-Control-Allow-Methods": "'GET,OPTIONS'",
                "Access-Control-Allow-Credentials": "'true'",
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
