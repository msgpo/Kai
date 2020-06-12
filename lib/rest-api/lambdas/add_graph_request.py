import boto3
import json
import os

def handler(event, context):
    request_body = json.loads(event["body"])

    # Check request is valid
    graph_id = request_body["graphId"]
    schema = request_body["schema"]

    # Todo refactor common request code into common module
    if graph_id is None:
        raise Exception("graphId is a required field")
    if schema is None:
        raise Exception("schema is a required field")

    # Get variables from env
    queue_url = os.getenv("sqs_queue_url")
    graph_table_name = os.getenv("graph_table_name")

    # Add Entry to table
    dynamo = boto3.resource("dynamodb")
    table = dynamo.Table(graph_table_name)

    initial_status = "CREATION_QUEUED"

    try:
        table.put_item(
            Item={
                "graphId": graph_id
                "status": initial_status
            },
            ConditionExpression=boto3.dynamodb.conditions.Attr("graphId").not_exists()
        )
    except ConditionalCheckFailedException:
        return {
            "statusCode": 400,
            "errorMessage": "Graph " + graph_id + " already exists. Graph names must be unique"
        }
    # todo send status with message body to reduce duplication

    # Create message to send to worker. This also filters out anything else in the body
    message = {
        "graphId": graph_id,
        "schema": schema,
        "expectedStatus": initial_status
    }

    sqs = boto3.client("sqs")
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message))

    return {
        "statusCode": 201
    }
