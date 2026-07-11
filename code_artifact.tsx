import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Music, 
  Upload, 
  Sparkles, 
  Download, 
  Trash2, 
  Play, 
  Pause, 
  Plus, 
  Compass, 
  Share2, 
  User, 
  Disc, 
  ListMusic, 
  Check, 
  AlertCircle,
  Volume2,
  VolumeX,
  ExternalLink
} from 'lucide-react';

// Add CSS keyframes for rotation and summer glow effects
const styleTag = document.createElement('style');
styleTag.innerHTML = `
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow {
    animation: spin-slow 15s linear infinite;
  }
  .animate-spin-paused {
    animation-play-state: paused;
  }
  .summer-gradient {
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%);
  }
  .glass-card {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
`;
document.head.appendChild(styleTag);

// Safe environment parsing for Firebase Config
let firebaseConfig = {};
try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    firebaseConfig = {
      apiKey: "mock-api-key",
      authDomain: "mock-domain.firebaseapp.com",
      projectId: "mock-project",
      storageBucket: "mock-bucket",
      messagingSenderId: "mock-sender",
      appId: "mock-app-id"
    };
  }
} catch (e) {
  console.error("Firebase config parse error", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'summer-playlist-app';

const SUMMER_PRESETS = [
  {
    name: "시원한 파도와 모래사장",
    style: "linear-gradient(to bottom, #0284c7, #38bdf8, #fef08a)",
    emoji: "🌊"
  },
  {
    name: "한여름 밤의 불꽃놀이",
    style: "linear-gradient(to top, #1e1b4b, #311042, #701a75)",
    emoji: "🎆"
  },
  {
    name: "열대 바닷가 일몰",
    style: "linear-gradient(to top, #f97316, #f43f5e, #881337)",
    emoji: "🌅"
  },
  {
    name: "싱그러운 청귤 라임",
    style: "linear-gradient(135deg, #4ade80, #22c55e, #bef264)",
    emoji: "🍹"
  },
  {
    name: "여름 뭉게구름 하늘",
    style: "linear-gradient(to bottom, #0ea5e9, #bae6fd, #ffffff)",
    emoji: "☁️"
  }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [studentName, setStudentName] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [comment, setComment] = useState('');
  
  // Cover Art Selection State
  const [coverType, setCoverType] = useState('preset'); 
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [uploadedImage, setUploadedImage] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiImage, setAiImage] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Active Simulated Playback State
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real Audio Streaming State (iTunes API)
  const [audioUrl, setAudioUrl] = useState('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const playlistContainerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Authentication failed: ", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      if (usr) {
        setUser(usr);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const publicCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');
    
    const unsubscribe = onSnapshot(
      publicCollectionRef, 
      (snapshot) => {
        const loadedTracks = [];
        snapshot.forEach((doc) => {
          loadedTracks.push({ id: doc.id, ...doc.data() });
        });
        
        loadedTracks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTracks(loadedTracks);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore loading error: ", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Dynamic Audio Finder Effect via iTunes Search API
  useEffect(() => {
    if (!nowPlaying) {
      setAudioUrl('');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const fetchAudioPreview = async () => {
      setAudioLoading(true);
      setAudioError(false);
      setAudioUrl('');
      setCurrentTime(0);
      
      try {
        const searchKeyword = `${nowPlaying.artist} ${nowPlaying.title}`;
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchKeyword)}&limit=1&entity=song`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          const track = data.results[0];
          setAudioUrl(track.previewUrl);
          setIsPlaying(true); // Auto-play on source change
        } else {
          // No preview found, fallback to silent simulation mode
          setAudioUrl('');
          setAudioError(true);
          setIsPlaying(true); // Still play animation and mockup timer
        }
      } catch (err) {
        console.error("Failed to query preview music: ", err);
        setAudioUrl('');
        setAudioError(true);
        setIsPlaying(true);
      } finally {
        setAudioLoading(false);
      }
    };

    fetchAudioPreview();
  }, [nowPlaying]);

  // Track Audio Play/Pause state synced with state variable
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      if (audioUrl) {
        audioRef.current.play().catch(e => {
          console.warn("Autoplay blocked by browser. User gesture needed.", e);
          setIsPlaying(false);
        });
      }
    } else {
      if (audioUrl) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl]);

  // Audio timer updater for simulated playback when real preview is missing
  useEffect(() => {
    let interval = null;
    if (isPlaying && !audioUrl) {
      // Setup a 30-second fake timer interval
      setDuration(30);
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 30) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioUrl]);

  // HTML5 audio elements control
  const handleTimeUpdate = () => {
    if (audioRef.current && audioUrl) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 30);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = value;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  // Format Helper: Seconds to MM:SS
  const formatTime = (timeInSecs) => {
    if (isNaN(timeInSecs)) return "00:00";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Image Compressor
  const compressImage = (file, maxWidth, maxHeight, quality, callback) => {
    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        setIsCompressing(false);
        callback(compressedBase64);
      };
      img.onerror = () => {
        setIsCompressing(false);
        setErrorMsg('이미지를 불러오는 데 실패했습니다.');
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setIsCompressing(false);
      setErrorMsg('파일을 읽는 도중 오류가 발생했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorMsg('');
    compressImage(file, 600, 600, 0.7, (compressedDataUrl) => {
      setUploadedImage(compressedDataUrl);
    });
  };

  const handleGenerateAiImage = async () => {
    if (!aiPrompt.trim()) {
      setErrorMsg('AI 이미지 아이디어를 입력해 주세요! (예: 파란 하늘과 갈매기, 귀여운 모래성)');
      return;
    }
    setErrorMsg('');
    setGeneratingAi(true);

    try {
      const enhancedPrompt = `A stunning digital artwork of ${aiPrompt}, rich vibrant summer sunset aesthetic, lofi ambient vibes, anime style wallpaper scenery, detailed beach scenery, square crop album cover art`;
      const payload = {
        instances: { prompt: enhancedPrompt },
        parameters: { sampleCount: 1 }
      };
      const apiKey = ""; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        setAiImage(imageUrl);
      } else {
        throw new Error('Image response format unexpected or missing.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('AI 이미지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSubmitTrack = async (e) => {
    e.preventDefault();
    if (!studentName.trim() || !title.trim() || !artist.trim()) {
      setErrorMsg('이름, 노래 제목, 가수는 필수값입니다.');
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg('');

    let finalCoverArt = '';
    if (coverType === 'preset') {
      finalCoverArt = JSON.stringify(SUMMER_PRESETS[selectedPreset]);
    } else if (coverType === 'upload') {
      if (!uploadedImage) {
        setErrorMsg('업로드한 이미지가 없습니다. 컴퓨터/모바일의 이미지 파일을 선택해 주세요.');
        setIsSubmitting(false);
        return;
      }
      finalCoverArt = uploadedImage;
    } else if (coverType === 'ai') {
      if (!aiImage) {
        setErrorMsg('AI로 생성된 이미지가 없습니다. 생성하기 버튼을 먼저 눌러주세요.');
        setIsSubmitting(false);
        return;
      }
      finalCoverArt = aiImage;
    }

    try {
      const publicCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');
      await addDoc(publicCollectionRef, {
        studentName: studentName.trim(),
        title: title.trim(),
        artist: artist.trim(),
        comment: comment.trim(),
        coverType,
        coverArt: finalCoverArt,
        createdAt: Date.now(),
        creatorUid: user?.uid || 'anonymous'
      });

      setTitle('');
      setArtist('');
      setComment('');
      setUploadedImage('');
      setAiPrompt('');
      setAiImage('');
      
      const boardElement = document.getElementById('class-board-section');
      if (boardElement) {
        boardElement.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error("Firestore writing error: ", err);
      setErrorMsg('우리 반 플레이리스트 등록에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrack = async (id, e) => {
    e.stopPropagation(); 
    if (confirm('이 노래를 우리 반 플레이리스트에서 지우시겠습니까?')) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id);
        await deleteDoc(docRef);
        if (nowPlaying?.id === id) {
          setNowPlaying(null);
          setIsPlaying(false);
        }
      } catch (err) {
        console.error("Deleting failed: ", err);
        setErrorMsg('삭제 과정 중 오류가 생겼습니다.');
      }
    }
  };

  const handlePlayTrack = (track) => {
    setNowPlaying(track);
  };

  const handleExportCard = (cardId) => {
    const cardElement = document.getElementById(cardId);
    if (!cardElement) return;

    if (window.html2canvas) {
      window.html2canvas(cardElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2 
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `여름_플레이리스트_${nowPlaying?.studentName || '카드'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(err => {
        console.error("Image generation error: ", err);
        setErrorMsg('카드 다운로드에 실패했습니다.');
      });
    } else {
      setErrorMsg('이미지 변환 엔진을 로딩하는 중입니다. 잠시 후 다시 클릭해 주세요!');
    }
  };

  // Helper to open search on YouTube in a new window
  const openYouTubeSearch = (title, artist, e) => {
    e.stopPropagation();
    const query = `${artist} ${title}`;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen summer-gradient text-slate-800 pb-20 font-sans selection:bg-sky-200">
      
      {/* Hidden Audio element for real playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleAudioEnded}
        />
      )}

      {/* Header section */}
      <header className="relative overflow-hidden pt-12 pb-16 text-center text-sky-950 px-4">
        <div className="absolute top-0 left-0 right-0 h-4 bg-sky-300 opacity-20"></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-100/80 text-sky-700 font-semibold text-sm mb-4 border border-sky-200/50">
            <span className="text-lg">🌊</span> [아티버셜 월간미술] 7월 미술 활동 연계형
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 drop-shadow-sm text-sky-900">
            나의 <span className="text-sky-600 underline decoration-wavy decoration-yellow-400">여름 플레이리스트</span>
          </h1>
          <p className="text-base md:text-lg text-sky-800/90 font-medium max-w-2xl mx-auto leading-relaxed">
            내가 가장 좋아하는 여름 노래를 적고 직접 꾸민 앨범 아트를 올려보세요! 등록하면 **30초 실제 음원**이 연동되어 친구들과 음악을 공유하며 감상할 수 있습니다.
          </p>
        </div>
      </header>

      {/* Main content grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column - Form Submission */}
        <section className="lg:col-span-5 bg-white/90 rounded-3xl p-6 md:p-8 shadow-xl shadow-sky-900/10 border border-sky-100 relative">
          <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-950 font-bold px-3 py-1 rounded-xl text-xs shadow-md transform rotate-6 animate-pulse">
            🎵 실제 음원 자동 재생 지원
          </div>
          
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-sky-900">
            <Plus className="w-6 h-6 text-sky-500" />
            내 노래 & 앨범 등록하기
          </h2>

          <form onSubmit={handleSubmitTrack} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-sky-950 mb-1.5">추천하는 학생 이름</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-5 w-5 text-sky-400" />
                <input 
                  type="text"
                  required
                  placeholder="예: 홍길동"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none text-slate-800 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-sky-950 mb-1.5">노래 제목</label>
                <input 
                  type="text"
                  required
                  placeholder="예: 여행"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none text-slate-800 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-sky-950 mb-1.5">가수 (아티스트)</label>
                <input 
                  type="text"
                  required
                  placeholder="예: 볼빨간사춘기"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none text-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-sky-950 mb-1.5">여름의 한 줄 평 (추천 메시지)</label>
              <textarea 
                placeholder="이 여름 노래를 들으면 기분이 어떤가요? 어떤 추억이 떠오르는지 들려주세요."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none text-slate-800 bg-white resize-none"
              />
            </div>

            {/* Cover art selection */}
            <div>
              <label className="block text-sm font-bold text-sky-950 mb-2">💿 앨범 커버 아트를 어떻게 꾸밀까요?</label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-sky-50 rounded-xl mb-4 border border-sky-100">
                <button
                  type="button"
                  onClick={() => setCoverType('preset')}
                  className={`py-2 px-1 text-xs md:text-sm font-semibold rounded-lg transition-all ${coverType === 'preset' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-sky-600'}`}
                >
                  기본 여름 테마
                </button>
                <button
                  type="button"
                  onClick={() => setCoverType('upload')}
                  className={`py-2 px-1 text-xs md:text-sm font-semibold rounded-lg transition-all ${coverType === 'upload' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-sky-600'}`}
                >
                  내 사진 업로드
                </button>
                <button
                  type="button"
                  onClick={() => setCoverType('ai')}
                  className={`py-2 px-1 text-xs md:text-sm font-semibold rounded-lg transition-all ${coverType === 'ai' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-sky-600'}`}
                >
                  AI 화가에게 부탁
                </button>
              </div>

              {coverType === 'preset' && (
                <div className="space-y-2">
                  <span className="text-xs text-sky-700 font-medium">여름과 잘 어울리는 감성 그라데이션 컬러:</span>
                  <div className="grid grid-cols-5 gap-2">
                    {SUMMER_PRESETS.map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedPreset(index)}
                        style={{ background: preset.style }}
                        className={`aspect-square rounded-lg flex items-center justify-center text-2xl transition-all relative group ${selectedPreset === index ? 'ring-4 ring-offset-2 ring-sky-500 scale-105' : 'hover:scale-105'}`}
                        title={preset.name}
                      >
                        <span>{preset.emoji}</span>
                        {selectedPreset === index && (
                          <span className="absolute -top-1 -right-1 bg-sky-600 text-white rounded-full p-0.5 shadow-sm">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {coverType === 'upload' && (
                <div className="border-2 border-dashed border-sky-200 rounded-xl p-4 text-center bg-white hover:bg-sky-50/50 transition-colors relative">
                  {isCompressing ? (
                    <div className="py-4 space-y-2">
                      <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs font-semibold text-sky-700">고화질 사진 화질 최적화 및 압축 중...</p>
                    </div>
                  ) : uploadedImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={uploadedImage} alt="Uploaded" className="w-24 h-24 object-cover rounded-lg shadow-md border-2 border-white" />
                      <p className="text-[11px] text-green-600 font-semibold">✓ 화질 자동 조절 및 압축 완료!</p>
                      <button 
                        type="button"
                        onClick={() => setUploadedImage('')}
                        className="text-xs text-red-500 hover:underline font-semibold"
                      >
                        사진 지우고 다시 올리기
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Upload className="w-8 h-8 text-sky-400 mx-auto mb-2" />
                      <span className="text-sm font-semibold text-sky-950 block">내가 그린 앨범 커버 이미지 선택</span>
                      <span className="text-xs text-slate-400 block mt-1">대용량 파일도 자동 압축되어 등록됩니다.</span>
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {coverType === 'ai' && (
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="한여름 해변에서 서핑하는 푸들 한마리"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-sky-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                    />
                    <button
                      type="button"
                      disabled={generatingAi}
                      onClick={handleGenerateAiImage}
                      className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      {generatingAi ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>생성 중..</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>생성</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">💡 한글로 상상하는 여름 풍경을 자유롭게 적으면, AI 화가가 앨범아트를 그려줘요!</span>

                  {aiImage && (
                    <div className="flex flex-col items-center gap-2 pt-2 border-t border-sky-200/50">
                      <img src={aiImage} alt="AI Art" className="w-28 h-28 object-cover rounded-lg shadow-md border-2 border-sky-200" />
                      <span className="text-xs text-sky-700 font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                        AI 앨범 커버 제작 성공!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start gap-2 text-rose-800 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sky-600/10 transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>등록하는 중...</span>
                </>
              ) : (
                <>
                  <Music className="w-5 h-5" />
                  <span>내 여름 플레이리스트 보드에 등록!</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right Column - Playlist Display & Interactivity */}
        <section className="lg:col-span-7 space-y-6" id="class-board-section">
          
          {/* Active Audio Player with iTunes Streaming */}
          {nowPlaying && (
            <div className="bg-sky-950 text-white rounded-3xl p-6 shadow-2xl flex flex-col gap-5 border border-sky-800 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.15),transparent)]"></div>
              
              {/* Main Player Info Grid */}
              <div className="flex flex-col md:flex-row items-center gap-5 relative z-10">
                {/* Rotating LP disk representation */}
                <div className="relative shrink-0">
                  {nowPlaying.coverType === 'preset' ? (
                    <div 
                      style={{ background: JSON.parse(nowPlaying.coverArt).style }} 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 border-slate-900/40 relative ${isPlaying ? 'animate-spin-slow' : 'animate-spin-slow animate-spin-paused'}`}
                    >
                      <span>{JSON.parse(nowPlaying.coverArt).emoji}</span>
                      <div className="absolute inset-0 rounded-full border-12 border-black/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-sky-950 border border-white/20"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={nowPlaying.coverArt} 
                        alt="Now Playing Cover" 
                        className={`w-28 h-28 object-cover rounded-full shadow-lg border-4 border-slate-900/40 ${isPlaying ? 'animate-spin-slow' : 'animate-spin-slow animate-spin-paused'}`} 
                      />
                      <div className="absolute inset-0 rounded-full bg-black/10 border-12 border-black/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-sky-950 border border-white/20"></div>
                      </div>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full p-1.5 shadow-md">
                    <Disc className="w-5 h-5 text-white animate-spin" />
                  </div>
                </div>

                {/* Song details */}
                <div className="flex-1 text-center md:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase">
                      {audioLoading ? "로딩 중..." : audioUrl ? "30초 미리듣기 재생" : "시뮬레이션 재생"}
                    </span>
                    {audioError && !audioLoading && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-300 font-bold px-2 py-0.5 rounded-full">
                        음원 대체됨
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl md:text-2xl font-extrabold truncate text-white">{nowPlaying.title}</h3>
                  <p className="text-slate-300 text-sm md:text-base font-semibold truncate">{nowPlaying.artist}</p>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-sky-900/60 px-3 py-1 rounded-full text-xs">
                      <User className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-slate-200">{nowPlaying.studentName} 학생 추천</span>
                    </div>

                    {/* YouTube Search Button */}
                    <button
                      onClick={(e) => openYouTubeSearch(nowPlaying.title, nowPlaying.artist, e)}
                      className="flex items-center gap-1 bg-red-600/90 hover:bg-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>원곡 YouTube 감상</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Slider and Play Controls */}
              <div className="bg-slate-900/40 p-4 rounded-2xl relative z-10 space-y-3">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={audioLoading}
                    className="bg-white hover:bg-yellow-400 disabled:bg-slate-500 text-sky-950 rounded-full p-3.5 transition-all shadow-md flex items-center justify-center shrink-0"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-sky-950" /> : <Play className="w-5 h-5 fill-sky-950 ml-0.5" />}
                  </button>

                  {/* Audio slider tracking */}
                  <div className="flex-1 space-y-1">
                    <input 
                      type="range"
                      min={0}
                      max={duration || 30}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Volume/Mute controls */}
                  <div className="hidden sm:flex items-center gap-2">
                    <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input 
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                  </div>
                </div>

                {nowPlaying.comment && (
                  <p className="text-xs text-slate-300 italic bg-sky-950/40 p-2.5 rounded-lg border border-sky-900/50">
                    💌 "{nowPlaying.comment}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Grid board of all submitted tracks */}
          <div className="glass-card rounded-3xl p-6 shadow-lg border border-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-sky-950 flex items-center gap-2">
                  <ListMusic className="w-6 h-6 text-sky-500" />
                  우리 반의 여름 바다 전광판 ({tracks.length}곡)
                </h3>
                <p className="text-slate-500 text-xs md:text-sm mt-0.5">앨범 카드를 클릭하면 음악이 흘러나옵니다.</p>
              </div>
              <button 
                onClick={() => {
                  if (tracks.length > 0) {
                    handlePlayTrack(tracks[Math.floor(Math.random() * tracks.length)]);
                  }
                }}
                className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-colors self-end sm:self-auto shadow-sm"
              >
                <Compass className="w-4 h-4" />
                <span>랜덤 플레이</span>
              </button>
            </div>

            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-500 text-sm font-medium">우리 반 앨범보드를 바다에서 건져 올리는 중...</p>
              </div>
            ) : tracks.length === 0 ? (
              <div className="py-20 text-center max-w-md mx-auto">
                <div className="text-5xl mb-4">🏖️</div>
                <h4 className="text-lg font-bold text-sky-950 mb-1">플레이리스트가 아직 비어 있습니다.</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  왼쪽 양식에서 첫 번째 여름 플리 트랙을 멋진 앨범 커버와 함께 채워 넣어 보세요!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" ref={playlistContainerRef}>
                {tracks.map((track) => {
                  const isTrackActive = nowPlaying?.id === track.id;
                  let parsedPreset = null;
                  if (track.coverType === 'preset') {
                    try {
                      parsedPreset = JSON.parse(track.coverArt);
                    } catch (e) {
                      parsedPreset = SUMMER_PRESETS[0];
                    }
                  }

                  return (
                    <div 
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className={`glass-card rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] relative group flex items-center gap-4 ${isTrackActive ? 'ring-2 ring-sky-500 bg-sky-50/70 border-sky-300' : 'border-sky-100'}`}
                    >
                      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden shadow-md relative flex items-center justify-center">
                        {track.coverType === 'preset' && parsedPreset ? (
                          <div style={{ background: parsedPreset.style }} className="w-full h-full flex items-center justify-center text-3xl">
                            <span>{parsedPreset.emoji}</span>
                          </div>
                        ) : (
                          <img src={track.coverArt} alt="Album Art" className="w-full h-full object-cover" />
                        )}

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isTrackActive && isPlaying ? (
                            <Pause className="w-7 h-7 text-white fill-white" />
                          ) : (
                            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full">
                          {track.studentName}
                        </span>
                        <h4 className="text-base font-bold text-sky-950 truncate mt-1 group-hover:text-sky-600 transition-colors">
                          {track.title}
                        </h4>
                        <p className="text-slate-500 text-xs font-semibold truncate">{track.artist}</p>
                        
                        {/* Quick Play & YouTube icons */}
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={(e) => openYouTubeSearch(track.title, track.artist, e)}
                            className="text-red-500 hover:text-red-600 flex items-center gap-0.5 text-[10px] font-bold"
                            title="유튜브에서 원곡 듣기"
                          >
                            <span>YouTube 원곡 ↗</span>
                          </button>
                        </div>
                      </div>

                      {/* Utility Action Buttons */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayTrack(track);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-sky-100 text-sky-700 transition-colors shadow-sm"
                          title="이쁜 카드 다운로드 받기"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTrack(track.id, e)}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-rose-100 text-rose-600 transition-colors shadow-sm"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Detail card modal */}
      {showDetailModal && nowPlaying && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative border-4 border-sky-200">
            
            <div className="bg-sky-100 px-5 py-3 border-b border-sky-200 flex items-center justify-between text-sky-950 font-bold">
              <span className="text-sm">나만의 플레이리스트 카드 소장</span>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="hover:bg-sky-200 rounded-lg p-1 text-slate-500 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-white" id={`printable-card-${nowPlaying.id}`}>
              <div className="border-4 border-dashed border-sky-100 rounded-2xl p-5 text-center bg-sky-50/20 relative">
                
                <div className="text-sky-950 mb-4 select-none">
                  <div className="text-xs font-bold tracking-wider text-sky-600">아티버셜 월간미술 7월 여름 테마</div>
                  <h3 className="text-2xl font-black mt-0.5 tracking-tight">나의 여름 플레이리스트</h3>
                  <div className="w-16 h-1 bg-yellow-400 mx-auto mt-1 rounded-full"></div>
                </div>

                <div className="w-52 h-52 mx-auto rounded-xl shadow-lg border-4 border-white overflow-hidden mb-5 flex items-center justify-center relative bg-white">
                  {nowPlaying.coverType === 'preset' ? (
                    <div 
                      style={{ background: JSON.parse(nowPlaying.coverArt).style }} 
                      className="w-full h-full flex items-center justify-center text-6xl"
                    >
                      <span>{JSON.parse(nowPlaying.coverArt).emoji}</span>
                    </div>
                  ) : (
                    <img 
                      src={nowPlaying.coverArt} 
                      alt="Detailed Card Cover" 
                      className="w-full h-full object-cover" 
                    />
                  )}
                </div>

                <div className="space-y-3.5 mb-6 text-left max-w-[240px] mx-auto text-slate-800">
                  <div className="border-b-2 border-dashed border-sky-200 pb-1">
                    <span className="text-xs font-bold text-sky-600 block">곡 제목</span>
                    <span className="text-base font-extrabold text-slate-800 tracking-tight">{nowPlaying.title}</span>
                  </div>
                  <div className="border-b-2 border-dashed border-sky-200 pb-1">
                    <span className="text-xs font-bold text-sky-600 block">가수</span>
                    <span className="text-base font-bold text-slate-700">{nowPlaying.artist}</span>
                  </div>
                  <div className="border-b-2 border-dashed border-sky-200 pb-1">
                    <span className="text-xs font-bold text-sky-600 block">만든 사람</span>
                    <span className="text-base font-extrabold text-slate-800">{nowPlaying.studentName}</span>
                  </div>
                  {nowPlaying.comment && (
                    <div className="bg-white/80 p-2.5 rounded-lg border border-sky-100 text-xs italic text-slate-600">
                      "{nowPlaying.comment}"
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-6 text-sky-800/60 pt-2 border-t border-sky-100/80">
                  <span className="text-xs">⏮</span>
                  <span className="text-lg">⏸</span>
                  <span className="text-xs">⏭</span>
                  <div className="flex items-center gap-1 bg-yellow-100/60 px-2 py-1 rounded text-[10px] font-bold text-yellow-700">
                    <span>☑ 확인</span>
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-sky-50 px-5 py-4 border-t border-sky-200 flex flex-col gap-2">
              <button
                onClick={() => handleExportCard(`printable-card-${nowPlaying.id}`)}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                <span>나의 여름 활동지 이미지 저장 (PNG)</span>
              </button>
              <p className="text-[10px] text-center text-slate-500">
                다운로드받은 이미지는 개인 프린트 및 디지털 소장용 포트폴리오로 아주 유용하게 쓸 수 있습니다.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Footer copyright info */}
      <footer className="mt-20 border-t border-sky-200/50 pt-8 text-center text-xs text-sky-800/60 max-w-3xl mx-auto px-4">
        <p className="font-semibold mb-1">우리 반 여름 플레이리스트 소통 공간</p>
        <p>[아티버셜 월간미술] 7월 여름플리 활동지.pdf 연계 보조 프로그램</p>
      </footer>

    </div>
  );
}