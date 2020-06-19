/*
 * Copyright 2020 Crown Copyright
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import { Cluster } from "@aws-cdk/aws-eks";
import { Queue } from "@aws-cdk/aws-sqs";
import { LayerVersion } from "@aws-cdk/aws-lambda";
import { LAMBDA_LAYER_ARN } from "../../lib/constants";
import { Worker } from "../../lib/workers/worker";
import { Table, AttributeType } from "@aws-cdk/aws-dynamodb";

test("Should create a Lambda Function", () => {
    // Given
    const stack = new cdk.Stack();
    const donorCluster = new Cluster(stack, "testCluster");
    const donorQueue = new Queue(stack, "testQueue");
    const table = new Table(stack, "test", {
        partitionKey: {name: "test", type: AttributeType.STRING}
    });
    const layer = LayerVersion.fromLayerVersionArn(stack, "testLayer", LAMBDA_LAYER_ARN);

    // When
    new Worker(stack, "testWorker", { // todo test all these
        queue: donorQueue,
        cluster: donorCluster,
        kubectlLayer: layer,
        graphTable: table,
        handler: "testHandler",
        timeout: cdk.Duration.minutes(10),
        batchSize: 1
    });

    // Then
    expectCDK(stack).to(haveResource("AWS::Lambda::Function", {
        Handler: "testHandler"
    }));
});

test("should allow lambda to consume messages from queue and describe cluster", () => {
    // Given
    const stack = new cdk.Stack();
    const donorCluster = new Cluster(stack, "testCluster");
    const donorQueue = new Queue(stack, "testQueue");
    const table = new Table(stack, "test", {
        partitionKey: {name: "test", type: AttributeType.STRING}
    });
    const layer = LayerVersion.fromLayerVersionArn(stack, "testLayer", LAMBDA_LAYER_ARN);

    // When
    new Worker(stack, "testWorker", {
        queue: donorQueue,
        cluster: donorCluster,
        kubectlLayer: layer,
        graphTable: table,
        handler: "testHandler",
        timeout: cdk.Duration.minutes(10),
        batchSize: 1
    });

    // Then
    expectCDK(stack).to(haveResourceLike("AWS::IAM::Policy", {
        "PolicyDocument": {
            "Statement": [
            {
                "Action": [
                "sqs:ReceiveMessage",
                "sqs:ChangeMessageVisibility",
                "sqs:GetQueueUrl",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes"
                ],
                "Effect": "Allow",
                "Resource": {
                "Fn::GetAtt": [
                    "testQueue601B0FCD",
                    "Arn"
                ]
                }
            },
            {
                "Action": "eks:DescribeCluster",
                "Effect": "Allow",
                "Resource": {
                "Fn::GetAtt": [
                    "testClusterFF806018",
                    "Arn"
                ]
                }
            }
            ]
        }
    }));
});

