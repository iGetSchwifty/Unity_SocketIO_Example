using UnityEngine;
using System.Collections;
using SocketIO;
using System;
using UnityEngine.UI;
using System.Collections.Generic;

public class socket_io : MonoBehaviour
{
    SocketIOComponent socket;
    player user_inst;
    gameBall _gameball;
    GameObject theyWin;
    bool isHost = false;
    public Material playerColor, outSide, greenColor;
    Transform pos;
    Dictionary<string, string> balldata;

    // Use this for initialization
    void Start()
    {
        //
        //  TODO: UNCOMMENT WHEN GOING TO PROD...
        //
        //GameObject go = GameObject.Find("SocketIO_AWS");
        GameObject go = GameObject.Find("SocketIO");
        _gameball = GetComponent<gameBall>();
        user_inst = Camera.main.GetComponent<player>();
        socket = go.GetComponent<SocketIOComponent>();
        balldata = new Dictionary<string, string>();
        theyWin = GameObject.Find("THEY_WIN");

        socket.On("client_connect", (SocketIOEvent e) => {
            //send down information they need for multiplayer.. perferably how many players are playing.. highscore data.. any news?
            json_user_data DANK = JsonUtility.FromJson<json_user_data>(e.data.ToString());
            high_score_data realDank = JsonUtility.FromJson<high_score_data>(DANK.dank);

            Dictionary<string, string> data = new Dictionary<string, string>();
            data["user_joined"] = user_inst.askForASpot();
            socket.Emit("cookieCheck", new JSONObject(data));
        });

        socket.On("confirm_player", (SocketIOEvent hb) => {
            current_game current = JsonUtility.FromJson<current_game>(hb.data.ToString());
            user_inst.loadAPlayer(current.spot);

            socket.On(current.gameID + "gameball", (SocketIOEvent gb) => {
                if (!_gameball.isGameStarted)
                {
                    //Start the game with gb information
                    iv_class iv = JsonUtility.FromJson<iv_class>(gb.data.ToString());
                    isHost = iv.server_host;

                    if (!isHost)
                    {
                        socket.On(current.gameID + "end_game", (SocketIOEvent endGame) => {
                            end_game_msg eg = JsonUtility.FromJson<end_game_msg>(endGame.data.ToString());
                            _gameball.displayMessageFromServer(eg.msg);
                        });
                    }
                    else
                    {
                        socket.On(current.gameID + "start_the_game", (SocketIOEvent startGame) => {
                            //TODO: COULD SEND MORE DATA BACK BUT FOR NOW WE JUST TELL THE HOST TO START GAME
                            _gameball.startKeepingScore();
                        });
                    }

                    _gameball.startTheGame(iv.IV_0, iv.IV_1, iv.IV_2, isHost);
                    if (isHost)
                    {
                        InvokeRepeating("updateBall", 0f, 0.05f);
                    }
                }
            });

            socket.On(current.gameID + "gameball_ball", (SocketIOEvent gb) => {
                if (!isHost)
                {
                    ball_position ball = JsonUtility.FromJson<ball_position>(gb.data.ToString());
                    _gameball.updateBallPos(ball.x, ball.y, ball.z, ball.vx, ball.vy, ball.vz);
                }
            });

            socket.On(current.gameID + "update_score", (SocketIOEvent sc) => {
                score_msg _score = JsonUtility.FromJson<score_msg>(sc.data.ToString());
                StartCoroutine(_gameball.displayScore(_score.score));
            });

            socket.On(current.gameID + "restart_Game", (SocketIOEvent gb) => {
                _gameball.restartTheGame();
            });

            socket.On(current.gameID, (SocketIOEvent data) => {
                game_data game = JsonUtility.FromJson<game_data>(data.data.ToString());
                for (int i = 1; i <= 32; i++)
                {
                    GameObject item = GameObject.Find(i.ToString());
                    item.GetComponent<MeshRenderer>().enabled = true;
                    item.GetComponent<MeshCollider>().isTrigger = false;
                    item.GetComponent<MeshCollider>().convex = false;
                    item.GetComponent<MeshCollider>().enabled = true;
                    foreach (Transform _childO in item.transform)
                    {
                        _childO.GetComponent<MeshRenderer>().material = outSide;
                    }
                }

                for (int i = 0, len = game.players.Length; i < len; i++)
                {
                    if (game.players[i] != user_inst.target.transform.name)
                    {
                        GameObject otherplayer = GameObject.Find(game.players[i]);
                        otherplayer.GetComponent<MeshRenderer>().enabled = false;
                        otherplayer.GetComponent<MeshCollider>().convex = false;
                        otherplayer.GetComponent<MeshCollider>().isTrigger = false;
                        otherplayer.GetComponent<MeshCollider>().enabled = false;
                        //TODO: NEED TO PUT A WIN OBJECT BEHIND THE PLAYER SO MAKE A PREFAB
                        foreach (Transform _childO in otherplayer.transform)
                        {
                            _childO.GetComponent<MeshRenderer>().material = greenColor;
                        }
                        if (isHost)
                        {
                            theyWin.transform.position = otherplayer.transform.position * 1.48f;
                            theyWin.transform.LookAt(otherplayer.transform);
                        }
                    }
                    else
                    {
                        GameObject otherplayer = GameObject.Find(game.players[i]);
                        otherplayer.GetComponent<MeshRenderer>().enabled = false;
                        otherplayer.GetComponent<MeshCollider>().convex = true;
                        otherplayer.GetComponent<MeshCollider>().isTrigger = true;
                        foreach (Transform _childO in otherplayer.transform)
                        {
                            _childO.GetComponent<MeshRenderer>().material = playerColor;
                        }
                    }
                }

            });
        });

    }
    void updateBall()
    {
        if (isHost && _gameball.TrackScore)
        {
            pos = _gameball.getBallPosition();
            balldata["ball_x"] = pos.position.x.ToString();
            balldata["ball_y"] = pos.position.y.ToString();
            balldata["ball_z"] = pos.position.z.ToString();
            balldata["vel_x"] = pos.GetComponent<Rigidbody>().velocity.x.ToString();
            balldata["vel_y"] = pos.GetComponent<Rigidbody>().velocity.y.ToString();
            balldata["vel_z"] = pos.GetComponent<Rigidbody>().velocity.z.ToString();
            socket.Emit("from_client_heartbeat", new JSONObject(balldata));
        }
    }

    public void sendEndGameMessage(string endGameMsg)
    {
        if (isHost)
        {
            Dictionary<string, string> gameEndingMessage = new Dictionary<string, string>();
            gameEndingMessage["gameMessage"] = endGameMsg;
            socket.Emit("from_client_endgame", new JSONObject(gameEndingMessage));
        }
    }

    public void updateMultiplayerspot(string newSpot)
    {
        if (_gameball.TrackScore)
        {
            Dictionary<string, string> data = new Dictionary<string, string>();
            data["new_spot"] = newSpot;
            socket.Emit("update_spot", new JSONObject(data));
        }
    }

    public void updateScore(string newScore)
    {
        if (isHost)
        {
            Dictionary<string, string> data = new Dictionary<string, string>();
            data["new_score"] = newScore;
            socket.Emit("update_score", new JSONObject(data));
        }
    }

    public void socketOpen()
    {
        socket.Connect();
    }

    public void socketClose()
    {
        socket.Close();
    }
}

[Serializable]
public class json_user_data
{
    public string dank;
}

[Serializable]
public class high_score_data
{
    public string single_highscore;
    public string multi_highscore;
    public int playerCount;
}

[Serializable]
public class current_game
{
    public string spot;
    public string gameID;
}

[Serializable]
public class game_data
{
    public string[] players;
}

[Serializable]
public class iv_class
{
    public float IV_0;
    public float IV_1;
    public float IV_2;
    public bool server_host;
}

[Serializable]
public class ball_position
{
    public float x;
    public float y;
    public float z;
    public float vx;
    public float vy;
    public float vz;
}
[Serializable]
public class end_game_msg
{
    public string msg;
}

[Serializable]
public class score_msg
{
    public string score;
}


