<?php

function playerTeamList() {
    $connection = ConnectionManager::get('mysql-write');
    error_reporting(0);
    $status		=	false;
    $message	=	NULL;
    $data		=	[];
    $data1		=	(object) array();
    $data_row	=	file_get_contents("php://input");
    $decoded    =	json_decode($data_row, true);
    $sport = @$decoded['sport'] ? $decoded['sport'] : 1;

    if(isset($_SERVER['HTTP_REMENBER_TOKEN']) && $_SERVER['HTTP_REMENBER_TOKEN'] != ''){
        $remember_token = $_SERVER['HTTP_REMENBER_TOKEN'];
        if($remember_token == md5(SECURITY_TOKEN)){
            if(!empty($decoded)){
                if(!empty($decoded['user_id']) && !empty($decoded['match_id']) && !empty($decoded['series_id'])){
                    $filter	=	'';
                    $key = 'teams_count-'.$decoded['user_id'].'-'.$decoded['match_id'];
                    $key = 'joined_count-'.$decoded['user_id'].'-'.$decoded['match_id'];
                        $currentDateTime	=	date('Y-m-d G:i:s');
                        // echo $currentDateTime;
                        $ctime =  strtotime($currentDateTime);
                        $mtime= strtotime($liveMatch->date." ".$liveMatch->time);
                    $playerTeamListKey = 'player_team_list_'.$decoded['user_id'].'-'.$decoded['match_id'];
                    if(isset($decoded['team_no'])) {
                        $filter	=	array('team_count'=>$decoded['team_no']);
                        $playerTeamListKey = 'player_team_list_'.$decoded['user_id'].'-'.$decoded['match_id'].'-'.$decoded['team_no'];
                    }
                    $status = true;

                    $result	=	$this->PlayerTeams->find()
                                ->where([$filter,'user_id'=>$decoded['user_id'],'match_id'=>$decoded['match_id'],'series_id'=>$decoded['series_id']])->toArray();

                    $player_list = array();
                    foreach ($result as $key => $value) {
                        $player_list = array_merge($player_list, explode(',', $value->players));
                    }
                    $player_list = array_unique($player_list);

                    $playerRecord	=	$this->PlayerRecord->find()->where(['player_id IN'=>$player_list])->toArray();
                    $playerData = array();
                    foreach ($playerRecord as $key => $value) {
                        $playerData[$value->player_id] = $value;
                    }


                    $teamData	=	$this->SeriesPlayers->find()->where(['series_id'=>$decoded['series_id'],'player_id IN'=>$player_list,'team_id'=>$liveMatch->localteam_id])->toArray();

                    $localPlayers = array();
                    foreach ($teamData as $key => $value) {
                        $localPlayers[] = $value->player_id;
                    }

                    if(!empty($result)) {
                        $captain	=	$viceCaptain	=	'';

                        foreach($result as $key=>$records){
                            $captain		=	$records->captain;
                            $viceCaptain	=	$records->vice_captain;
                            $substitute		=	$records->substitute;
                            $playerTeamId	=	$records->id;
                            $playerTeamNo	=	$records->team_count;
                            $totalPoints	=	is_null($records->points) ? 0 : $records->points;
                            $playerDetail	=	[];

                            $totalBowler=	$totalBatsman	=	$totalWicketkeeper	=	$totalAllrounder	=	0;

                            if(!empty($records->players)){
                                $playerTeamDetails	=	explode(',', $records->players);

                                foreach($playerTeamDetails as $teamKey => $teamValue){
                                    $teamValue	=	$playerData[$teamValue];
                                    $playerImage	=	'';

                                    if(!empty($teamValue)) {
                                        $playerImage	=	CONTENT_URL.'uploads/player_image/'.$teamValue->image;
                                    }
                                    if($mtime < $ctime) {
                                        $point = $this->getPlayerPoint($decoded['series_id'],$decoded['match_id'],$teamValue->player_id,$captain,$viceCaptain);
                                    } else {
                                        $point = 0;
                                    }
                                    if($mtime < $ctime) {
                                        $dreamPlayerskey = 'dreamPlayers'.$decoded['series_id'].'-'.$decoded['match_id'].'-'.$teamValue->player_id;

                                        if (($dreamPlayers = Cache::read($dreamPlayerskey, $config = 'five_min')) === false){
                                            $dreamPlayers	=	$this->DreamTeams->find()->where(['series_id'=>$decoded['series_id'],'match_id'=>$decoded['match_id'],'player_id'=>$teamValue->player_id])->first();
                                            Cache::write($dreamPlayerskey, $dreamPlayers, $config = 'five_min');
                                        }
                                    }

                                    $islocalTeam	=	in_array($teamValue->player_id, $localPlayers) ? true : false;

                                    $playerDetail[$teamKey]['name']		=	$teamValue->player_name;
                                    $playerDetail[$teamKey]['player_id']=	$teamValue->player_id;
                                    $playerDetail[$teamKey]['image']	=	$playerImage;
                                    $playerDetail[$teamKey]['role']		=	$teamValue->playing_role;
                                    $playerDetail[$teamKey]['credits']	=	$teamValue->player_credit;
                                    $playerDetail[$teamKey]['points']	=	$point;
                                    $playerDetail[$teamKey]['is_local_team']=	$islocalTeam;
                                    $playerDetail[$teamKey]['in_dream_team']=	!empty($dreamPlayers) ? true : false;

                                    if(strpos($teamValue->playing_role, 'Wicketkeeper') !== false) {
                                        $totalWicketkeeper	+=	1;
                                        unset($playerTeamDetails[$teamKey]);
                                    } else
                                    if(strpos($teamValue->playing_role, 'Bowler') !== false) {
                                        $totalBowler	+=	1;
                                        unset($playerTeamDetails[$teamKey]);
                                    } else
                                    if(stripos($teamValue->playing_role, 'Batsman') !== false) {
                                        $totalBatsman	+=	1;
                                        unset($playerTeamDetails[$teamKey]);
                                    } else
                                    if(stripos($teamValue->playing_role, 'Allrounder') !== false) {
                                        $totalAllrounder	+=	1;
                                        unset($playerTeamDetails[$teamKey]);
                                    }
                                }
                                $status	=	true;
                            }

                            $data[$key]['teamid']					=	$playerTeamId;
                            $data[$key]['team_number']				=	$playerTeamNo;
                            $data[$key]['total_point']				=	$totalPoints;
                            $data[$key]['captain_player_id']		=	$captain;
                            $data[$key]['vice_captain_player_id']	=	$viceCaptain;
                            $data[$key]['total_bowler']				=	$totalBowler;
                            $data[$key]['total_batsman']			=	$totalBatsman;
                            $data[$key]['total_wicketkeeper']		=	$totalWicketkeeper;
                            $data[$key]['total_allrounder']			=	$totalAllrounder;
                            $data[$key]['player_details']			=	$playerDetail;
                            $data[$key]['substitute_detail']		=	$substituteDetail;
                            $data[$key]['my_teams']		=	$myTeams;
                            $data[$key]['my_contests']		=	$myContest;

                        }

                    }
                    $data1	=	$data;
                } else {
                    $message	=	__("user id, match id or series id are empty.", true);
                }
            } else {
                $message	=	__("You are not authenticated user.", true);
            }
        }else{
            $message	=	__("Security check failed.", true);
        }
    }else{
        $message	=	__("Security check failed.", true);
    }

    $response_data	=	array('status'=>$status,'message'=>$message,'data'=>$data1);
    echo json_encode(array('response' => $response_data));
    die;
}
