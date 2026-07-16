import React from 'react';

export default function LoginModal({
  showLoginModal,
  setShowLoginModal,
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  username,
  setUsername,
  department,
  setDepartment,
  handleLogin,
  handleRegister
}) {
  if (!showLoginModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp">
      <div className="w-[400px] glass-panel-deep p-6 flex flex-col gap-4 rounded-2xl">
        <div className="flex justify-between items-center border-b border-hairline pb-3">
          <h3 className="text-sm font-semibold text-ink">
            {authMode === 'login' ? '🔑 도시행정망 실무자 인증' : '📝 신규 실무자 계정 등록'}
          </h3>
          <button 
            onClick={() => {
              setShowLoginModal(false);
              setEmail('');
              setPassword('');
              setUsername('');
            }} 
            className="text-ink-secondary hover:text-ink text-lg font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex gap-2 border-b border-hairline pb-3">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setPassword('');
            }}
            className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all cursor-pointer border ${
              authMode === 'login' 
                ? 'bg-primary/10 text-primary border-primary/20' 
                : 'bg-transparent text-ink-secondary hover:text-ink border-transparent'
            }`}
          >
            로그인 모드
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setPassword('');
            }}
            className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all cursor-pointer border ${
              authMode === 'register' 
                ? 'bg-primary/10 text-primary border-primary/20' 
                : 'bg-transparent text-ink-secondary hover:text-ink border-transparent'
            }`}
          >
            회원가입 모드
          </button>
        </div>

        <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-ink-secondary">소속 자치구 / 부서</span>
            <select 
              value={department} 
              onChange={(e) => setDepartment(e.target.value)}
              className="text-input-notion w-full"
            >
              <option value="용산구 스마트도시과">용산구 스마트도시과</option>
              <option value="용산구 도시계획과">용산구 도시계획과</option>
              <option value="용산구 보건위생과">용산구 보건위생과</option>
            </select>
          </div>

          {authMode === 'register' && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-ink-secondary">실무자 이름</span>
              <input 
                type="text" 
                placeholder="홍길동 주무관"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="text-input-notion"
              />
            </div>
          )}

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-ink-secondary">행정 이메일</span>
            <input 
              type="email" 
              placeholder="admin@yongsan.go.kr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-input-notion"
            />
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-ink-secondary">행정망 비밀번호</span>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-input-notion"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full text-xs py-2.5"
          >
            {authMode === 'login' ? '행정망 접속 승인' : '신규 실무자 등록 신청'}
          </button>
        </form>
      </div>
    </div>
  );
}
