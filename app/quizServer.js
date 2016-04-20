var User = require('./models/user');
var exports = module.exports = {};
var Highscore = require('./models/highscore');
var async = require('async');

exports.validateAnswer = function (req, callback) {
    "use strict";
    let validateAnswerResult = {
        'scoreUp': 0,
        'gameFinished': false,
        'name': req.session.quizName,
        'questionIndex': req.session.answerIndex + 1
    };
    let shouldCallback = true;

    req.session.validateAnswerResult = validateAnswerResult;
    if (wasTheAnswerCorrect(req)) {
        let timeStampDiff = new Date().getTime() - req.session.startTimeStamp;
        req.session.startTimeStamp = new Date().getTime();

        if (req.session.gamePlayTimeBased) {
            validateAnswerResult.scoreUp = req.session.questionsAndAnswers[req.session.answerIndex].answers[req.body.data].point / calculateScoreDivisor(timeStampDiff);
        } else {
            validateAnswerResult.scoreUp = req.session.questionsAndAnswers[req.session.answerIndex].answers[req.body.data].point;
        }

        req.session.score += validateAnswerResult.scoreUp;
    }

    validateAnswerResult.gameFinished = isAnswerIndexTheLastOrInvalid(req.session);
    if (validateAnswerResult.gameFinished) {
        saveHighScore(req, callback);
        shouldCallback = false;
    }
    req.session.answerIndex++;
    if (shouldCallback) {
        callback();
    }
};

exports.saveInSessionHighScoreFor = function (quizName, req, cb) {
    "use strict";
    req.session.retrievedHighScore = [];
    async.series([
        function (callback) {
            Highscore
                .find({})
                .sort({score: -1})
                .limit(10)
                .exec( function (err, result) {
                    if (err) return callback(err);
                    pushRetrievedHighScoreInToSession(req, result, 0, callback);
                });
        }
    ], function (err) {
        cb(err);
    });
};

function pushRetrievedHighScoreInToSession(req, highScores, index, cb) {
    "use strict";
    if (!highScores[index]) {
        cb();
        return;
    }
    async.series([
        function (callback) {
            User.findById(highScores[index].userId, function (err, user) {
                if(user) {
                    let highScoreEntry = {
                        user: user.displayName,
                        score: highScores[index].score,
                        date: highScores[index].dateTime,
                        quizName: highScores[index].quizName
                    };
                    req.session.retrievedHighScore.push(highScoreEntry);
                }
                callback();
            });
        }], function (err) {
            pushRetrievedHighScoreInToSession(req, highScores, index+1, cb);
    });
}

function isAnswerIndexTheLastOrInvalid(session) {
    return session.quizLength <= session.answerIndex + 1;
}

function wasTheAnswerCorrect(req) {
    return  answerWereSubmitted(req) &&
            req.session.questionsAndAnswers[req.session.answerIndex].answers[req.body.data].valid;
}

function answerWereSubmitted(req) {
    return  req.session.questionsAndAnswers[req.session.answerIndex] &&
            req.session.questionsAndAnswers[req.session.answerIndex].answers &&
            req.session.questionsAndAnswers[req.session.answerIndex].answers[req.body.data];
}


function saveHighScore(req, cb) {
    "use strict";
    async.series([
        function (callback) {
            saveNewScore(req, callback);
        }
    ], function (err) {
        cb(err);
    });
}

function updateUserScoreIfBetter(result, req, callback) {
    "use strict";
    if (result.score < req.session.score) {
        saveNewScore(req, callback, result);
    }
    callback();
}

function saveNewScore(req, callback, result) {
    "use strict";
    console.log("new hs: " + req.session.score);
    var highscore = result || new Highscore();
    highscore.quizName = req.session.quizName;
    highscore.userId = req.user.id;
    highscore.score = req.session.score;
    highscore.save(function (err) {
        if (err) return callback(err);
    });
    callback();
}

function isObjectEmpty(o) {
    return Object.getOwnPropertyNames(o).length === 0;
}
function calculateScoreDivisor(timeStampDiff) {
    return (timeStampDiff / 3600);
}
