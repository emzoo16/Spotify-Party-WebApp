import React from 'react';
import SearchBar from './SearchBar';
import './hostPage.css';
import SideBar from './SideBar';
import MusicLi from './MusicLi';
import { connect } from 'react-redux';
import api from '../api';
import util from '../util'
import { MdAdd } from 'react-icons/md';
import { MdCheck } from 'react-icons/md';
import {
    updatePlaylist,
    play,
    pause,
    updateRoomInfo,
    updateActiveMusic,
    restoreDefault,
    updateActiveMusicState
} from '../redux/actions';
import io from 'socket.io-client';
import playBack from '../playBack';


const socket = io();

let needNotify = false;

class ConnectHostPage extends React.Component {


    constructor(props) {
        super(props);

        this.state = {
            tracks: [],     // store search result
            active: false,
        };

        this.GetResult = this.GetResult.bind(this);
        this.searchRef = React.createRef();
        this.initWs = this.initWs.bind(this);
        this.initWs();
    }

    initWs() {

        socket.on('refresh_play_list', () => {
            console.log('Guest: refresh_play_list received!!');
            this.clientRequestData()
            .then(data => {
                this.props.dispatch(updatePlaylist(data['tracks']));
            }).catch(console.error.bind(this));
        });
    }

    clientRequestData(){
        return api.checkPartyCode(this.props.roomId)
        .then(response => {
            if(response.status !== 200){
                alert('cannot join');
                return Promise.reject(response)
            }
            return response.json();
        })
    }

    playControl(event) {
        if (event.nextState === 'PAUSE') {
            this.props.musicInfo[0]['play_state'] = 0;
            api.uploadPlayList(this.props.roomId, this.props.musicInfo, () => {
                socket.emit('change_request', (data) => {
                        // callback
                        console.log('server responded: ', data);
                });
            });
            return this.props.dispatch(pause(event.uri));
        } else if (event.nextState === 'PLAYING') {
            this.props.musicInfo[0]['play_state'] = 1;
            api.uploadPlayList(this.props.roomId, this.props.musicInfo, () => {
                socket.emit('change_request', (data) => {
                    // callback
                    console.log('server responded: ', data);
                });
            });
            return this.props.dispatch(play(event));
        }
    }

    playNext() {
        if (this.props.musicInfo.length < 2) {
            alert('you can\'t play next when there is only one');
            return;
        }

        let prevUri = this.props.activeMusicUri;
        let nextUri = this.props.musicInfo[1].uri;
        let newMusicInfo = this.props.musicInfo;

        this.playControl({
            uri: nextUri,
            nextState: 'PLAYING',
            resume: false
        })
            .then(response => {
                let oldIndex = newMusicInfo.findIndex(e => e.uri === prevUri);
                newMusicInfo.splice(oldIndex, 1);
                newMusicInfo[0]['play_state'] = 1;
                this.props.dispatch(updatePlaylist(newMusicInfo));
                this.props.dispatch(updateActiveMusicState('PLAYING'));
                needNotify = true;
            });
    }

    removeAMusic(uri) {
        let newMusicInfo = this.props.musicInfo;
        let i = newMusicInfo.findIndex(e => e.uri === uri);
        this.removeTrackFromLiked(newMusicInfo[i].uri)
        newMusicInfo.splice(i, 1);

        this.props.dispatch(updatePlaylist(newMusicInfo));
        needNotify = true;
    }

    GetResult(searchItem) {
        if (searchItem) {
            api.searchItem(searchItem)
                .then(array => {
                    if (this.searchRef.current.state.searching) {
                        console.log('search outcome: ', array);
                        this.setState({
                            tracks: array,
                            active: true
                        });
                    }
                });
        } else {
            this.setState({ tracks: [] });
            this.setState({ active: false });
        }
    }

    componentDidMount() {
        if(this.props.iniAtLanding)
            return

        let param = util.getParamFromUrl();
        // refresh page at path /host
        api.checkPartyCode(param['roomId'])
        .then(response => {
            return response.json();
        })
        .then(data => {
            this.props.dispatch( updateRoomInfo({
                userName: data.name,
                roomId: data.room_id,
                iniAtLanding: false
            }))
            if (data['tracks'] !== undefined && data['tracks'].length !== 0){
                data['tracks'][0]['play_state'] = 0;
            }
            this.props.dispatch(updatePlaylist(data['tracks']));
            playBack.getTokenFromServer(data.room_id);
            needNotify = true;
        })
        .catch(error => {
            console.error("host page: ", error)
            alert("error: see console")
        })
    }

    componentWillUnmount(){
        this.props.dispatch(pause())
        .then(() => {
            this.props.dispatch( updateActiveMusicState('STOP') );
        })

        this.props.musicInfo[0]['play_state'] = 0;
        api.uploadPlayList(this.props.roomId, this.props.musicInfo, () => {
            socket.emit('change_request', (data) => {
                    // callback
                    socket.close()
                    console.log('server responded: ', data);
            });
        });

        this.props.dispatch(restoreDefault())

    }


    likeStateChanged(index, isLike) {
        let newList = Array.from(this.props.musicInfo);
        if (isLike) {
            this.addTrackToLiked(newList[index].uri)
            newList[index]['votes'] = newList[index]['votes'] + 1;
        } else {
            this.removeTrackFromLiked(newList[index].uri)
            newList[index]['votes'] = newList[index]['votes'] - 1;
        }
        this.props.dispatch(updatePlaylist(this.props.musicInfo));
        needNotify = true;
    }

    selectSearchItem(item) {
        let musicInfoCopy = Array.from(this.props.musicInfo)
        let i = musicInfoCopy.findIndex(e => e.uri === item.uri)
        if (i !== -1){
            let liked = this.trackIsLiked(musicInfoCopy[i].uri)
            if (liked) {
                this.removeTrackFromLiked(musicInfoCopy[i].uri)
                musicInfoCopy[i].votes -= 1
                item.selected = false
                alert("This song already in the queue, you just **unvoted**")
            }
            else {
                this.addTrackToLiked(musicInfoCopy[i].uri)
                musicInfoCopy[i].votes += 1
                item.selected = true
                alert("This song already in the queue, you just **voted**")
            }
        }else {
            musicInfoCopy.push({
                'play_state': 0,
                'votes': 0,
                'name': item['trackName'],
                'uri': item['uri'],
                'artist': item['artistName'],
                'album': item['albumName'],
                'albumIcon': {
                    'small': item.albumIcon['small'].url,
                    'large': item.albumIcon['large'].url
                }
            })
            item.selected = true
        }

        this.props.dispatch(updatePlaylist(musicInfoCopy));
        needNotify = true;
    }

    removeTrackFromLiked(trackUri){
        let likedTracks = JSON.parse(sessionStorage.getItem("likedTracks"))
        let indexOfTrack = likedTracks.indexOf(trackUri)
        if(indexOfTrack !== -1) likedTracks.splice(indexOfTrack, 1)
        sessionStorage.setItem("likedTracks", JSON.stringify(likedTracks))
    }

    addTrackToLiked(trackUri){
        let likedTracks=JSON.parse(sessionStorage.getItem("likedTracks"))
        likedTracks.push(trackUri)
        sessionStorage.setItem("likedTracks", JSON.stringify(likedTracks))
    }

    trackIsLiked(trackUri){
        let likedTracks=JSON.parse(sessionStorage.getItem("likedTracks"))
        let indexOfTrack = likedTracks.indexOf(trackUri)
        if(indexOfTrack === -1) return false
        return true
    }

    render() {
        return (
            <div className={'hostPage'}>
                <SideBar userName={this.props.userName}
                    roomId={this.props.roomId}>
                </SideBar>

                <div className={'content_container'}>
                    <SearchBar GetResult={this.GetResult} ref={this.searchRef}/>

                    <div className={'page'}>
                        {/* search result container */}

                        <div className={'search-results ' + (this.state.active ? '' : 'hidden')}
                             onClick={() => {
                                 this.setState({ active: false });
                                 this.searchRef.current.state.searching = false;
                                 // this.savePlaylist();
                             }}>

                            {/* search result items */}
                            {this.state.tracks.map((item, index) => {
                                return (
                                    <div className={'result'} key={index} onClick={event => {
                                        this.selectSearchItem(item);
                                        event.stopPropagation();
                                    }}>
                                        <div className="img">
                                            <img src={item.albumArt} alt=""/>
                                        </div>
                                        <div className={'info'}>
                                            <div className={'top'} title={item.trackName}>
                                                {item.trackName}
                                            </div>
                                            <div className={'bottom'}>
                                                <span className={'album-name'} title={item.albumName}>
                                                    {item.albumName}
                                                </span>
                                                <span className={'dot'}>.</span>
                                                <span className={'artist-name'}>
                                                    {item.artistName}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={'addSong'} onClick={event => {
                                            this.selectSearchItem(item);
                                            event.stopPropagation();
                                        }}>
                                            {item.selected ?
                                                <MdCheck className={'icon'}> </MdCheck> :
                                                <MdAdd className={'icon'}>
                                                </MdAdd>}
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                        <div className={'tracklist'}>
                            {
                                this.props.musicInfo.length !== 0 ? this.props.musicInfo.map((entry, index) => {
                                    return (
                                        <MusicLi name={entry.name}
                                                 album={entry.album}
                                                 votes={entry.votes}
                                                 icon={entry.albumIcon['large']}
                                                 uri={entry.uri}
                                                 activeMusicUri={this.props.activeMusicUri}
                                                 playControl={this.playControl.bind(this)}
                                                 playNext={this.playNext.bind(this)}
                                                 removeAMusic={this.removeAMusic.bind(this)}
                                                 index={index}
                                                 key={entry.uri}
                                                 clickLike={this.likeStateChanged.bind(this)}
                                                 liked={this.trackIsLiked(entry.uri)}>
                                        </MusicLi>
                                    );
                                }) : <span className={'hint'}> Search to add musics </span>
                                // console.log(this.props.musicInfo)
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    api.uploadPlayList(state.roomId, state.musicInfo, () => {
        if (needNotify) {
            socket.emit('change_request', (data) => {
                // callback
                console.log('server responded: ', data);
            });
            needNotify = false;
        }
    });

    return {
        userName: state.userName,
        roomId: state.roomId,

        // existing playlist
        musicInfo: state.musicInfo,
        activeMusicUri: state.activeMusicUri
    };
};



export const HostPage = connect(mapStateToProps, null)(ConnectHostPage);
