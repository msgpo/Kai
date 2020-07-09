import boto3
from botocore.exceptions import ClientError
import json
import os
import re

def is_graph_name_valid(graph_Name):
    if graph_Name  is None:
        return False
    
    return re.match("^[a-zA-Z0-9]+$", graph_Name) # Graph names have to be alphanumerics


def lowercase_graph_name(graph_Name):
    return graph_Name.lower()
    

def handler(event, context):
    request_body = json.loads(event["body"])

    # Check request is valid
    graph_Name = request_body["graphName"]
    schema = request_body["schema"]

    if not is_graph_name_valid(graph_Name):
        return {
            "statusCode": 400,
            "body": "graphName is a required field which must made up of alphanumeric characters"
        }
    if schema is None:
        return {
            "statusCode": 400,
            "body": "schema is a required field"
        }
    # Convert graph name to lowercase
    release_Name = lowercase_graph_name(graph_Name)

    # Get variables from env
    queue_url = os.getenv("sqs_queue_url")
    graph_table_name = os.getenv("graph_table_name")

    # Add Entry to table
    dynamo = boto3.resource("dynamodb")
    table = dynamo.Table(graph_table_name)

    initial_status = "DEPLOYMENT_QUEUED"

    try:
        table.put_item(
            Item={
                "releaseName": release_Name,
                "currentState": initial_status
            },
            ConditionExpression=boto3.dynamodb.conditions.Attr("releaseName").not_exists()
        )
    except ClientError as e:
        if e.response['Error']['Code']=='ConditionalCheckFailedException': 
            return {
                "statusCode": 400,
                "body": "Graph " + release_Name + " already exists. Graph names must be unique"
            }
        else:
            return {
                "statusCode": 500,
                "body": json.dumps(e.response["Error"])
            }

    # Create message to send to worker. This also filters out anything else in the body
    message = {
        "id": release_Name,
        "schema": schema,
        "expectedStatus": initial_status
    }

    sqs = boto3.client("sqs")
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message))

    return {
        "statusCode": 201
    }
