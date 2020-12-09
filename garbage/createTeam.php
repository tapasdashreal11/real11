<?php

function createTeam() {
    $connection = ConnectionManager::get('mysql-write'); // For Clusting
    $status		=	false;
    $message	=	NULL;
    $data		=	[];
    $data1		=	(object) array();
    $data_row	=	file_get_contents("php://input");
    $decoded    =	json_decode($data_row, true);
    $sport = (@$decoded['sport'] && !empty($decoded['sport'])) ? $decoded['sport'] : 1;
    $sport = 1;
    $decoded['sport'] = 1;
    $this->loadModel('PlayerTeams');
    $this->loadModel('seriesPlayers');
    $this->loadModel('PlayerTeamDetails');
    $this->loadModel('Users');
    $this->loadModel('SeriesSquad');

    if(isset($_SERVER['HTTP_REMENBER_TOKEN']) && $_SERVER['HTTP_REMENBER_TOKEN'] != '')
    {
        $remember_token = $_SERVER['HTTP_REMENBER_TOKEN'];
        if(!empty($decoded)){
            if(!empty($decoded['user_id']) && !empty($decoded['match_id']) && !empty($decoded['series_id']) && !empty($decoded['player_id'])){
                $users	=	$this->Users->find()->where(['Users.id'=>$decoded['user_id'],'Users.status'=>ACTIVE])->first();
                if(!empty($users)){
                    $token = $this->generate_token($users->id,$users->auth_token);
                    if(isset($token) && $remember_token == $token){
                        $currentDate=	date('Y-m-d');
                        $liveTime	=	date('H:i',strtotime(MATCH_DURATION));
                        $currentTime=	date('H:i');
                        $currentDateTime	=	date('Y-m-d G:i:s');
                        $this->SeriesSquad->connection($connection); // For Clusting
                        $liveMatchkey = 'liveMatch'.$decoded['match_id'];

                        if (($liveMatch = Cache::read($liveMatchkey, $config = 'one_min')) === false){
                            $liveMatch	=	$this->SeriesSquad->find()
                                            ->where(['match_id'=>$decoded['match_id'],'series_id'=>$decoded['series_id']])->first();
                            Cache::write($liveMatchkey, $liveMatch, $config = 'one_min');
                        }

                        $ctime =  strtotime($currentDateTime);
                        $mtime= strtotime($liveMatch->date." ".$liveMatch->time);

                        if($mtime < $ctime) {
                            $message	=	__('Match Already Closed ',true);
                            $response_data	=	array('status'=>0,'message'=>$message,'data'=>$data1);
                            echo json_encode(array('response' => $response_data));
                            die;
                        }

                        if(!empty($liveMatch)){
                            $playerIds	=	array_unique($decoded['player_id']);

                            if ($sport == 1){
                                if(count($playerIds) != 11){
                                    $message	=	__('Please select valid team ',true);
                                    $response_data	=	array('status'=>$status,'message'=>$message,'data'=>$data1);
                                    echo json_encode(array('response' => $response_data));
                                    die;
                                }
                            }

                            if ($sport == 2){
                                if(count($playerIds) != 8){
                                    $message	=	__('Please select valid team ',true);
                                    $response_data	=	array('status'=>$status,'message'=>$message,'data'=>$data1);
                                    echo json_encode(array('response' => $response_data));
                                    die;
                                }
                            }
                            $wk = 0; $bat = 0; $bowl = 0; $ar = 0;

                            $decoded['player_id']	=	$playerIds;

                            if ($sport == 2) {
                                $this->PlayerTeams->connection($connection); // For Clusting
                                $teamDataa	=	$this->PlayerTeams->find()
                                                ->where(['user_id'=>$decoded['user_id'],'match_id'=>$decoded['match_id'],'series_id'=>$decoded['series_id'],'captain'=>$decoded['captain'],'vice_captain'=>0])
                                                ->contain(['PlayerTeamDetails'])->toArray();
                            }

                            if ($sport == 1) {
                                $this->PlayerTeams->connection($connection); // For Clusting
                                $teamDataa	=	$this->PlayerTeams->find()
                                                ->where(['user_id'=>$decoded['user_id'],'match_id'=>$decoded['match_id'],'series_id'=>$decoded['series_id'],'captain'=>$decoded['captain'],'vice_captain'=>$decoded['vice_captain']])
                                                ->contain(['PlayerTeamDetails'])->toArray();
                            }

                            $statusAdd	=	false;

                            if(!empty($teamDataa)){
                                $checkPlayer	=	[];

                                if(!empty($decoded['team_id'])){
                                    foreach($teamDataa as $playerKey => $playerTeams){
                                        $isPlayer	=	[];
                                        if(count($teamDataa) > 1){
                                            if($decoded['team_id'] != $playerTeams->id){
                                                if(!empty($playerTeams->players)){
                                                    $players = explode(',', $playerTeams->players);
                                                    foreach($players as $playerDetail){
                                                        if(in_array($playerDetail,$decoded['player_id'])){
                                                            $isPlayer[]	=	1;
                                                        } else {
                                                            $isPlayer[]	=	0;
                                                        }
                                                    }
                                                }

                                                if(in_array(0,$isPlayer) && $playerTeams->captain == $decoded['captain'] && $playerTeams->vice_captain == $decoded['vice_captain']){
                                                    $checkPlayer[$playerKey]	=	1;
                                                } else {
                                                    $checkPlayer[$playerKey]	=	0;
                                                }
                                            }
                                        } else {
                                            $checkPlayer[0]	=	1;
                                        }
                                    }
                                } else {
                                    foreach($teamDataa as $playerKey => $playerTeams){
                                        $isPlayer	=	[];
                                        if(!empty($playerTeams->players)){
                                            $players = explode(',', $playerTeams->players);
                                            foreach($players as $playerDetail){
                                                if(in_array($playerDetail,$decoded['player_id'])){
                                                    $isPlayer[]	=	1;
                                                } else {
                                                    $isPlayer[]	=	0;
                                                }
                                            }
                                        }

                                        if(in_array(0,$isPlayer)){
                                            $checkPlayer[$playerKey]	=	1;
                                        } else {
                                            $checkPlayer[$playerKey]	=	0;
                                        }
                                    }
                                }

                                if(in_array(1,$checkPlayer)){
                                    $statusAdd	=	true;
                                }
                            } else {
                                $statusAdd	=	true;
                            }
                            if($statusAdd == true){
                                $playerData	=	[];
                                $pids	=	[];
                                if(!empty($decoded['player_id'])){
                                    foreach($decoded['player_id'] as $key=> $playerId){
                                        $playerData[$key]['player_id']	=	$playerId;
                                        $pids[] = $playerId;
                                    }
                                }
                                if(!empty($decoded['team_id'])) {
                                    $this->PlayerTeams->connection($connection); // For Clusting
                                    $team	=	$this->PlayerTeams->find()->where(['id'=>$decoded['team_id'],'user_id' => $decoded['user_id']])->contain(['PlayerTeamDetails'])->first();
                                    if(!empty($team->players)){
                                        $playerTeam = TableRegistry::get('PlayerTeamDetails');
                                        $playerTeam->setConnection($connection); // For Clusting
                                    }
                                } else {
                                    $this->PlayerTeams->connection($connection); // For Clusting
                                    $getTeamCount	=	$this->PlayerTeams->find()->where(['user_id'=>$decoded['user_id'],'match_id'=>$decoded['match_id'],'series_id'=>$decoded['series_id']])->group(['team_count'])->count();
                                    $teamcount		=	$getTeamCount + 1;
                                    $team	=	$this->PlayerTeams->newEntity();
                                    $decoded['team_count']		=	$teamcount;
                                }
                                $this->PlayerTeams->connection($connection); // For Clusting
                                $this->PlayerTeamDetails->connection($connection); // For Clusting
                                $this->PlayerTeams->patchEntity($team,$decoded);
                                $team->created	=	date('Y-m-d G:i:s');
                                $team->players = implode(',', $pids);
                                if($teamData = $this->PlayerTeams->save($team)) {
                                    $status	=	true;
                                    $data1->team_id	=	$teamData->id;
                                    if(!empty($decoded['team_id'])) {
                                        $playerTeamListKey = 'player_team_list_'.$decoded['user_id'].'-'.$decoded['match_id'];
                                        $playerTeamListKey2 = 'player_team_list_'.$decoded['user_id'].'-'.$decoded['match_id'].'-'.$teamData->team_count;
                                        $message	=	__("Team has been updated successfully.", true);
                                    } else {
                                        $playerTeamListKey = 'player_team_list_'.$decoded['user_id'].'-'.$decoded['match_id'];
                                        $key = 'teams_count-'.$decoded['user_id'].'-'.$decoded['match_id'];
                                        $message	=	__("Team has been created successfully.", true);
                                    }
                                } else {
                                    if(!empty($decoded['team_id'])) {
                                        $message	=	__("Team could not update.", true);
                                    } else {
                                        $message	=	__("Team could not create.", true);
                                    }
                                }
                            } else {
                                $message	=	__("This team is already created, please make changes in team players or change team captain/vice captain to continue.", true);
                            }
                        } else {
                            $message	=	__('You can not create team, match already started',true);
                        }
                    } else{
                        $message	=	__("Security check failed.", true);
                    }
                }else{
                    $message	=	__("Invalid User id.", true);
                }
            } else {
                $message	=	__("match id, series id or Player list are empty.", true);
            }
        } else {
            $message	=	__("You are not authenticated user.", true);
        }
    }else{
        $message	=	__("Security check failed.", true);
    }

    $response_data	=	array('status'=>$status,'message'=>$message,'data'=>$data1);
    echo json_encode(array('response' => $response_data));
    die;
}