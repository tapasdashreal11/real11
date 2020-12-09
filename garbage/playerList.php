<?php

function playerList() {
    $status		=	false;
    $message	=	NULL;
    $data		=	[];
    $data1		=	(object) array();
    $data_row	=	file_get_contents("php://input");
    $decoded    =	json_decode($data_row, true);
    $sport = @$decoded['sport'] ? $decoded['sport'] : 1;
    $this->loadModel('SeriesSquad');
    $this->loadModel('SeriesPlayers');
    $this->loadModel('PlayerRecord');
    $this->loadModel('LiveScore');
    $this->loadModel('PlayerTeams');
    $this->loadModel('PlayerTeamDetails');
    $this->loadModel('Playing');
    $seriesPlayerTable	   =	TableRegistry::get('SeriesPlayers');
    if(isset($_SERVER['HTTP_REMENBER_TOKEN']) && $_SERVER['HTTP_REMENBER_TOKEN'] != ''){
        $remember_token = $_SERVER['HTTP_REMENBER_TOKEN'];
        if($remember_token == md5(SECURITY_TOKEN)){
            if(!empty($decoded)) {
                if(!empty($decoded['match_id']) && !empty($decoded['series_id']) && !empty($decoded['local_team_id']) && !empty($decoded['visitor_team_id'])) {
                    $key = "result_player".$decoded['match_id'];
                    if (($result = Cache::read($key, $config = 'thirty_sec')) === false) {
                        $result	=	$this->SeriesSquad->find()->where(['SeriesSquad.match_id'=>$decoded['match_id'],'SeriesSquad.series_id'=>$decoded['series_id'],'status'=>ACTIVE,'SeriesSquad.sport' => $sport])
                            ->join([
                                'table' => 'playing',
                                'alias' => 'p',
                                'type' => 'LEFT',
                                'conditions' => 'SeriesSquad.id = p.match_key',
                            ])
                            ->select(['series_id','type','id','p.playing_11'])->first();
                        Cache::write($key, $result, $config = 'thirty_sec');
                    }

                    if(!empty($result)) {
                        $type			=	strtolower($result->type);
                        $key = "result_for_series".$decoded['match_id'];
                        if (($seriesPlayers = Cache::read($key, $config = 'thirty_min')) === false) {
                                $seriesPlayers	=	$this->SeriesPlayers->find()
                                ->select(['player_point' => '(SELECT SUM(point) FROM live_score WHERE seriesId = "'.$result->series_id.'" AND playerId = PlayerRecord.player_id)'])		
                                ->select(['selected_by' => '((SELECT COUNT(player_teams.id) FROM player_teams WHERE FIND_IN_SET(PlayerRecord.player_id, player_teams.players) AND player_teams.match_id = "'.$decoded['match_id'].'") / (SELECT COUNT(id) FROM player_teams WHERE match_id = "'.$decoded['match_id'].'") * 100)'])
                                ->select(['captain_selected' => '((SELECT COUNT(player_teams.id) FROM player_teams WHERE player_teams.captain=PlayerRecord.player_id AND player_teams.match_id = "'.$decoded['match_id'].'") / (SELECT COUNT(id) FROM player_teams WHERE match_id = "'.$decoded['match_id'].'") * 100)'])
                                ->select(['vice_captain_selected' => '((SELECT COUNT(player_teams.id) FROM player_teams WHERE player_teams.vice_captain=PlayerRecord.player_id AND player_teams.match_id = "'.$decoded['match_id'].'") / (SELECT COUNT(id) FROM player_teams WHERE match_id = "'.$decoded['match_id'].'") * 100)'])
                                ->select(['id','team_id','team_name','player_id','player_name','player_role','series_id'])
                                ->where([$type=>'True','series_id'=>$result->series_id,'SeriesPlayers.sport' => $sport,'SeriesPlayers.team_id IN'=>[$decoded['local_team_id'],$decoded['visitor_team_id']]])->contain(['PlayerRecord' => ['fields' => ['id','player_id','player_name','image','playing_role','player_credit']]])
                                ->group(['PlayerRecord.player_id'])->toarray();
                        Cache::write($key, $seriesPlayers, $config = 'thirty_min');
                        }
                        foreach($seriesPlayers as $players) {
                            $playerTotalPoints	=	!is_null($players->player_point) ? $players->player_point : "0";
                            $selectedBy	=	$players->selected_by ? $players->selected_by : 0;
                            $captain_selected	=	$players->captain_selected ? $players->captain_selected : 0;
                            $vice_captain_selected	=	$players->vice_captain_selected ? $players->vice_captain_selected : 0;

                            if(!empty($players->player_record)) {
                                $players->player_record->image	=	CONTENT_URL.'uploads/player_image/'.$players->player_record->image;
                            }

                            $players->player_points		=	(float)$playerTotalPoints;
                            $players->selected_by		=	number_format($selectedBy,0).'%';
                            $players->captain_selected		=	number_format($captain_selected,0).'%';
                            $players->vice_captain_selected		=	number_format($vice_captain_selected,0).'%';
                            $playing = $result->p['playing_11'];
                            if(!empty($playing)) {
                                $players11 = unserialize($playing);
                                $players->is_playing_show		=	1;
                                $players->is_playing		=	in_array($players->player_id, $players11) ? 1 : 0;
                            } else {
                                $players->is_playing_show		=	0;
                                $players->is_playing		=	0;
                            }
                        }

                    } else {
                        $message	=	__('Series does not exist.',true);
                    }

                    $data1	=	$seriesPlayers;
                    $status	=	true;
                } else {
                    $message	=	__("match id, series id, local team id or visitor team id are empty.", true);
                }
            } else {
                $message	=	__("You are not authenticated user.", true);
            }
        } else {
            $message	=	__("Security check failed.", true);
        }
    } else {
        $message	=	__("Security check failed.", true);
    }

    $response_data	=	array('status'=>$status,'message'=>$message,'data'=>$data1);
    echo json_encode(array('response' => $response_data));
    die;
}