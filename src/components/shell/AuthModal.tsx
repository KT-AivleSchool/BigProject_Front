"use client";

import React, { useState, useEffect } from "react";
import { postJson, ApiError } from "@/lib/omnisite/client";
import { UserLogin, UserRegister, TokenResponse, UserResponse, setAuthToken, setRefreshToken, setAuthUser } from "@/lib/omnisite/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserResponse) => void;
  initialMode?: "login" | "register";
}

export function AuthModal({ isOpen, onClose, onSuccess, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [username, setUsername] = useState("");

  // Terms states
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  useEffect(() => {
    if (agreeTerms && agreePrivacy && agreeMarketing) {
      setAgreeAll(true);
    } else {
      setAgreeAll(false);
    }
  }, [agreeTerms, agreePrivacy, agreeMarketing]);

  if (!isOpen) return null;

  const handleAgreeAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAgreeAll(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeMarketing(checked);
  };

  const handleNextStep = () => {
    if (!agreeTerms || !agreePrivacy) {
      setError("필수 약관에 모두 동의해 주세요.");
      return;
    }
    setError(null);
    setRegisterStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "register" && registerStep === 1) {
      handleNextStep();
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        if (password !== passwordConfirm) {
          setError("비밀번호가 일치하지 않습니다.");
          setLoading(false);
          return;
        }

        const payload: UserRegister = { email, password, username };
        await postJson<UserResponse>("/api/v1/auth/register", payload);
        
        // On successful register, switch to login mode automatically
        switchMode("login");
        setError("회원가입이 완료되었습니다. 로그인해 주세요."); 
      } else {
        const payload: UserLogin = { email, password };
        const tokenData = await postJson<TokenResponse>("/api/v1/auth/login", payload);
        
        // Save token
        setAuthToken(tokenData.access_token);
        // 🔴 재발급용 토큰은 **로그인 응답에 원래부터 있었는데 여기서 버려지고 있었다**
        //    (백엔드 `auth.py:155`). 이게 없으면 상단 배지의 연장 버튼이 못 돈다.
        //    스키마상 `str | None` 이라 없을 수도 있다 — 그때는 지우고, 배지가
        //    「재발급용 토큰이 없다」고 말한다. 기본값을 지어내지 않는다.
        setRefreshToken(tokenData.refresh_token ?? null);

        let username = email.split("@")[0] ?? "user";
        let userId = 0;
        try {
          const base64Url = tokenData.access_token.split('.')[1] || "";
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const decoded = JSON.parse(jsonPayload);
          if (decoded.username) username = decoded.username;
          if (decoded.user_id) userId = decoded.user_id;
        } catch (e) {
          console.error("JWT decoding failed", e);
        }

        const authUser: UserResponse = {
          id: userId,
          email: email,
          username: username,
          is_active: true
        };
        setAuthUser(authUser);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("omnisite-auth-change"));
        }
        onSuccess(authUser);
        onClose();

      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError(null);
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setUsername("");
    setRegisterStep(1);
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setAgreeMarketing(false);
    setAgreeAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        
        <div className="flex border-b border-gray-200 shrink-0">
          <button 
            type="button"
            className={`flex-1 py-4 text-center font-bold transition-colors ${mode === "login" ? "bg-white text-primary border-b-2 border-primary" : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            onClick={() => switchMode("login")}
          >
            로그인
          </button>
          <button 
            type="button"
            className={`flex-1 py-4 text-center font-bold transition-colors ${mode === "register" ? "bg-white text-primary border-b-2 border-primary" : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            onClick={() => switchMode("register")}
          >
            회원가입
          </button>
        </div>

        <div className="overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className={`p-3 rounded-md text-sm font-medium ${error.includes("완료") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {error}
              </div>
            )}

            {/* Login Mode */}
            {mode === "login" && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">이메일</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">비밀번호</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="비밀번호 입력"
                  />
                </div>
              </>
            )}

            {/* Register Mode - Step 1: Terms */}
            {mode === "register" && registerStep === 1 && (
              <div className="space-y-5">
                <label className="flex items-center gap-2 text-base font-bold text-gray-900 pb-3 border-b border-gray-200 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                    checked={agreeAll} 
                    onChange={handleAgreeAll} 
                  />
                  서비스 약관에 모두 동의합니다.
                </label>

                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-[13px] leading-relaxed rounded-md">
                  - 필수 항목은 서비스 제공을 위해 필요한 항목이므로, 동의를 거부하시는 경우 서비스 이용에 제한이 있을 수 있습니다.
                </div>

                <div className="space-y-4 text-sm text-gray-700 pl-1">
                  <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-gray-900">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={agreeTerms} 
                      onChange={(e) => setAgreeTerms(e.target.checked)} 
                    />
                    [필수] 이용약관 동의
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-gray-900">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          checked={agreePrivacy} 
                          onChange={(e) => setAgreePrivacy(e.target.checked)} 
                        />
                        [필수] 개인정보 수집 및 이용 동의
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showPrivacyDetails ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                    </div>

                    {showPrivacyDetails && (
                      <div className="mt-2 border border-gray-200 rounded-md overflow-hidden text-[11px]">
                        <table className="w-full text-center bg-gray-50/50 divide-y divide-gray-200">
                          <thead>
                            <tr className="bg-gray-100 text-gray-600">
                              <th className="py-2 px-1 font-medium border-r border-gray-200">목적</th>
                              <th className="py-2 px-1 font-medium border-r border-gray-200">항목</th>
                              <th className="py-2 px-1 font-medium">보유기간</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr>
                              <td className="py-2 px-2 border-r border-gray-200">플랫폼 일반 회원가입 및 서비스 이용, 유지, 종료</td>
                              <td className="py-2 px-2 border-r border-gray-200">성명, 이메일(아이디), 비밀번호 등</td>
                              <td className="py-2 px-2">플랫폼 제공 서비스 이용기간 동안</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={agreeMarketing} 
                      onChange={(e) => setAgreeMarketing(e.target.checked)} 
                    />
                    [선택] 이벤트, 뉴스 정보 수신 동의
                  </label>
                </div>
              </div>
            )}

            {/* Register Mode - Step 2: User Info Input */}
            {mode === "register" && registerStep === 2 && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">이메일(아이디)</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="user@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">이름</label>
                  <input 
                    type="text" 
                    required 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="홍길동"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">비밀번호</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="새 비밀번호"
                  />
                  <p className="text-[11px] text-red-500/80 mt-1 leading-tight">
                    영문, 숫자, 특수문자 중 2종류 이상을 조합하여 10~16자리 (3종류는 8~16자리)로 구성할 수 있습니다.
                  </p>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-sm font-medium text-gray-700">비밀번호 확인</label>
                  <input 
                    type="password" 
                    required 
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="새 비밀번호 확인"
                  />
                </div>
              </>
            )}

            <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 shrink-0">
              {mode === "register" && registerStep === 2 && (
                <button 
                  type="button" 
                  onClick={() => setRegisterStep(1)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 mr-auto"
                  disabled={loading}
                >
                  이전
                </button>
              )}
              
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={loading}
              >
                취소
              </button>
              
              <button 
                type="submit" 
                className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 flex items-center justify-center min-w-[120px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || (mode === "register" && registerStep === 1 && (!agreeTerms || !agreePrivacy))}
              >
                {loading ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  mode === "login" ? "로그인" : 
                  mode === "register" && registerStep === 1 ? "일반 회원가입" : "가입하기"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
