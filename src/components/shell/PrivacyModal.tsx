"use client";

import React, { useEffect } from "react";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">개인정보처리방침</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 text-sm text-gray-700 space-y-8">
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">제1조 총칙</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>개인정보란 생존하는 개인에 관한 정보로서 성명, 주민등록번호 등에 의하여 당해 개인을 알아볼 수 있는 부호, 문자, 음성, 음향, 영상 및 생체 특성 등에 관한 정보(당해 정보만으로는 특정 개인을 알아볼 수 없는 경우에도 다른 정보와 용이하게 결합하여 알아볼 수 있는 것을 포함)를 말합니다.</li>
              <li>주식회사 KT(이하 "회사"라 한다)는 정보주체의 개인정보를 중요시하며, 『개인정보 보호법』과 개인정보 보호 관련 각종 법규를 준수하고 있습니다.</li>
              <li>회사는 개인정보처리방침을 통하여 정보주체의 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.</li>
              <li>회사의 개인정보처리방침은 관련 법령 및 내부 운영 방침의 변경에 따라 개정될 수 있습니다. 개인정보처리방침이 개정되는 경우에는 시행일자 등을 부여하여 개정된 내용을 홈페이지(https://aivle.edu.kt.co.kr/)에 지체 없이 공지합니다.</li>
              <li>영업의 전부 또는 일부를 양도하거나 합병 등으로 개인정보를 이전하는 경우 서면 전자우편 등을 통하여 정보주체에게 개별적으로 통지하고, 회사의 과실 없이 정보주체의 연락처를 알 수 없는 경우에 해당하여 서면, 전자우편 등으로 통지할 수 없는 경우에는 홈페이지(https://aivle.edu.kt.co.kr/), 첫 화면에서 식별할 수 있도록 표기하여 30일 이상 그 사실을 공지합니다. 단, 천재지변 등 정당한 사유로 홈페이지 게시가 곤란한 경우에는 2곳 이상의 중앙일간지(정보주체의 대부분이 특정 지역에 거주하는 경우에는 그 지역을 보급구역으로 하는 일간지로 할 수 있습니다.)에 1회 이상 공고하는 것으로 갈음합니다.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">제2조 개인정보의 수집·이용 목적, 항목 및 보유 기간</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 교육과정 운영(수강, 출결, 수료, 평가, 교육 이력 관리 등), 훈련비용 지원, 취업서비스 제공 등을 위하여 필요한 범위에서 최소한의 개인정보만을 수집합니다.</li>
              <li>회사는 사상, 신념, 가족 및 친인척관계 등 정보주체의 권리 이익이나 사생활을 뚜렷하게 침해할 우려가 있는 개인정보는 수집하지 않습니다. 다만, 정보주체가 수집에 동의하시거나 다른 법률에 따라 특별히 수집 대상 개인정보로 허용된 경우에는 필요한 범위에서 최소한으로 위 개인정보를 수집할 수 있습니다.</li>
              <li>회사가 수집하는 개인정보 항목과 수집·이용하는 목적은 다음과 같습니다.<br />가. 필수 수집/이용 목적 및 항목</li>
            </ol>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border-collapse border border-gray-300 text-center">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 py-2 px-4">수집 및 이용 항목</th>
                    <th className="border border-gray-300 py-2 px-4">수집 및 이용 목적</th>
                    <th className="border border-gray-300 py-2 px-4">보유기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 py-2 px-4">성명(한글, 영문), 연락처</td>
                    <td className="border border-gray-300 py-2 px-4">교육과정 운영(수강, 출결, 평가 등)</td>
                    <td className="border border-gray-300 py-2 px-4">5년</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">제3조 개인정보의 수집방법</h3>
            <p>회사는 다음과 같은 방법으로 개인정보를 수집합니다.</p>
            <p className="pl-4 text-gray-600">가. 온라인/오프라인 등록 신청서 작성 등을 통해 수집</p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">제4조 개인정보의 파기절차 및 방법</h3>
            <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 파기절차 및 방법은 다음과 같습니다.</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>파기절차<br/>
                가. 정보주체의 개인정보는 수집 및 이용목적이 달성된 후 별도의 DB로 옮겨져(종이의 경우 별도의 서류함) 내부 방침 및 기타 관련 법령에 의한 정보보호 사유(보유 및 이용기간 참조)에 따라 일정 기간 저장된 후 파기됩니다.<br/>
                나. 별도 DB로 옮겨진 개인정보는 법률에 의한 경우가 아니고서는 보유되는 이외의 다른 목적으로 이용되지 않습니다.
              </li>
              <li>파기방법<br/>
                가. 종이(서면)에 작성·출력된 개인정보 : 분쇄하거나 소각 등의 방법으로 파기<br/>
                나. DB 등 전자적 파일 형태로 저장된 개인정보 : 재생할 수 없는 기술적 방법으로 삭제
              </li>
            </ol>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">제5조 수집한 개인정보의 공유 및 제공</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 정보주체의 사전 동의 없이 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다.<br/>
                가. 관련 법령(통신비밀보호법, 전기통신사업법, 국세기본법 등)에 특별한 규정이 있는 경우로서, 법령에 정해진 규정과 절차에 따라 제공하는 경우
              </li>
              <li>교육 서비스 제공과 관련하여 정보주체의 사전 동의를 받아 정보주체의 개인정보를 제3자에게 제공하는 내역은 다음과 같습니다.</li>
            </ol>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border-collapse border border-gray-300 text-center">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 py-2 px-4">제공받는 자</th>
                    <th className="border border-gray-300 py-2 px-4">이용목적</th>
                    <th className="border border-gray-300 py-2 px-4">항목</th>
                    <th className="border border-gray-300 py-2 px-4">보유 및 이용기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 py-2 px-4">협력사 등</td>
                    <td className="border border-gray-300 py-2 px-4">교육운영(수강 등)</td>
                    <td className="border border-gray-300 py-2 px-4">성명, 연락처</td>
                    <td className="border border-gray-300 py-2 px-4">목적 달성 시까지</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="my-6 border-gray-200" />

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">개인정보의 기술적·관리적 보호조치 기준 개요</h2>
            
            <h3 className="text-lg font-bold text-gray-900 mt-6">제4장 개인정보의 안전한 관리</h3>
            <p><strong>제29조(안전조치의무)</strong> 개인정보처리자는 개인정보가 분실·도난·유출·위조·변조 또는 훼손되지 아니하도록 내부 관리계획 수립, 접속기록 보관 등 대통령령으로 정하는 바에 따라 안전성 확보에 필요한 기술적·관리적 및 물리적 조치를 하여야 한다. &lt;개정 2015. 7. 24.&gt;</p>
            <p className="text-sm text-gray-500">[개인정보보호법 제4장 제29조]</p>

            <p className="mt-4"><strong>제48조의2(개인정보의 안전성 확보 조치에 관한 특례)</strong> ① 정보통신서비스 제공자(「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제2조제1항제3호에 해당하는 자를 말한다. 이하 같다)와 그로부터 이용자(같은 법 제2조제1항제4호에 해당하는 자를 말한다. 이하 같다)의 개인정보를 법 제17조제1항제1호에 따라 제공받은 자(이하 “정보통신서비스 제공자등”이라 한다)는 이용자의 개인정보를 처리하는 경우에는 제30조에도 불구하고 법 제29조에 따라 <span className="text-teal-600 font-medium">다음 각 호의 안전성 확보 조치를 해야 한다.</span><br/>(각 호 내용 생략)<br/><span className="text-teal-600">③ 제1항에 따른 안전성 확보 조치에 관한 세부 기준은 보호위원회가 정하여 고시한다.</span></p>
            <p className="text-sm text-gray-500">[개인정보 보호법 시행령 제48조의2제3항]</p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">제4조 접근통제</h3>
            
            <div className="bg-orange-50 p-4 border border-orange-200 rounded-md">
              <strong>① 정보통신서비스 제공자등은 개인정보처리시스템에 대한 접근권한을 서비스 제공을 위하여 필요한 개인정보 보호책임자 또는 개인정보취급자에게만 부여한다.</strong>
            </div>
            
            <ul className="list-disc pl-5 space-y-2">
              <li>정보통신서비스 제공자등은 개인정보처리시스템에 대한 접근권한을 서비스 제공을 위해 필요한 <span className="underline decoration-teal-500 decoration-2">최소한의 인원에게 부여</span>하여야 한다.
                <p className="mt-2 text-gray-600">- 특히, 개인정보처리시스템의 데이터베이스(DB)에 직접 접속은 <span className="underline decoration-teal-500 decoration-2">데이터베이스 운영·관리자에 한정하는 등의 보호조치를 적용</span>할 필요성이 있다.</p>
              </li>
              <li>정보통신서비스 제공자등은 개인정보처리시스템에 열람, 수정, 다운로드 등 접근권한을 부여할 때에는 서비스 제공을 위해 필요한 범위에서 구체적으로 차등화 하여 부여하여야 한다.</li>
            </ul>

            <div className="bg-orange-50 p-4 border border-orange-200 rounded-md mt-6">
              <strong>④ 정보통신서비스 제공자등은 개인정보취급자가 정보통신망을 통해 외부에서 개인정보처리시스템에 접속이 필요한 경우에는 안전한 인증 수단을 적용하여야 한다.</strong>
            </div>

            <ul className="list-disc pl-5 space-y-2">
              <li>인터넷 구간 등 외부로부터 개인정보처리시스템에 접속은 원칙적으로 차단하여야 하나, 정보통신서비스 제공자등의 업무 특성 또는 필요에 의해 개인정보취급자가 노트북, 업무용 컴퓨터, 모바일 기기 등으로 외부에서 정보통신망을 통해 개인정보처리시스템에 접속이 필요할 때에는 안전한 인증수단을 적용하여야 한다.
                <p className="mt-2 text-gray-600">- 안전한 인증 수단의 적용 : <span className="underline decoration-teal-500 decoration-2">개인정보처리시스템에 사용자계정과 비밀번호를 입력하여 정당한 개인정보취급자 여부를 식별·인증하는 절차 이외에 추가적인 인증 수단의 적용을 말한다.</span></p>
              </li>
            </ul>

            <div className="mt-4 border border-gray-300 rounded-md">
              <div className="bg-gray-100 font-bold text-center py-2 border-b border-gray-300">인증 수단 (예시)</div>
              <div className="p-4 space-y-2 text-sm text-gray-600">
                <p>☞ 인증서(PKI, Public Key Infrastructure) : 전자상거래 등에서 상대방과의 신원확인, 거래사실 증명, 문서의 위·변조 여부 검증 등을 위해 사용하는 전자서명으로서 해당 전자서명을 생성한 자의 신원을 확인하는 수단</p>
                <p>☞ 보안토큰 : 암호 연산장치 등으로 내부에 저장된 정보가 외부로 복사, 재생성 되지 않도록 공인인증서 등을 안전하게 보호할 수 있는 수단으로 스마트카드, USB 토큰 등이 해당</p>
                <p>☞ <span className="underline decoration-teal-500 decoration-2">일회용 비밀번호(OTP, One Time Password) : 무작위로 생성되는 난수를 일회용 비밀번호로 한번 생성하고, 그 값을 한 번만 사용할 수 있도록 하는 방식</span></p>
              </div>
            </div>

            <div className="bg-orange-50 p-4 border border-orange-200 rounded-md mt-6">
              <strong>⑦ 정보통신서비스 제공자등은 이용자가 안전한 비밀번호를 이용할 수 있도록 비밀번호 작성규칙을 수립하고, 이행한다.</strong>
            </div>

            <ul className="list-disc pl-5 space-y-2">
              <li>정보통신서비스 제공자등은 이용자가 안전한 비밀번호를 설정하여 이용할 수 있도록 비밀번호 작성규칙을 수립하고, 이를 인터넷 홈페이지 등에 적용하여야 한다.</li>
            </ul>

            <div className="mt-4 border border-gray-300 rounded-md">
              <div className="bg-gray-100 font-bold text-center py-2 border-b border-gray-300">안전한 비밀번호 이용 방안 (예시)</div>
              <div className="p-4 space-y-2 text-sm text-gray-600">
                <p>☞ <span className="underline decoration-teal-500 decoration-2">(생성) 비밀번호 길이와 복잡도 설정, 계정(ID)과 비밀번호를 동일하게 생성 금지</span>, 비밀번호 재발급 시 랜덤하게 임시 비밀번호를 발급하여 최초 로그인시 새로운 비밀번호로 변경하도록 적용 등</p>
                <p>☞ <span className="underline decoration-teal-500 decoration-2">(암호화) 비밀번호는 전송 시 암호화 적용, 저장 시 일방향(해쉬) 암호화 적용 등</span></p>
                <p>☞ (변경) 비밀번호 사용 만료일 이전에 이용자에게 알려주어 변경 유도, 비밀번호 유효기간을 설정하여 강제 변경 등</p>
                <p>☞ <span className="underline decoration-teal-500 decoration-2">(공격 대응) 5회 이상 로그인 시도 실패 시 계정 잠금, 로그인 실패 횟수에 따라 로그인 지연시간 설정</span>, 사전에 있는 단어 사용 금지, 비밀번호에 난수 추가(Salting) 등</p>
                <p>☞ (운영 관리) 일정시간 작업이 없는 로그온 세션 종료, 장기 휴면계정 계정 삭제, 비밀번호 공유 금지, 초기값(Default) 비밀번호 변경 후 사용, 로그인 시도 및 로그인 기록 유지, 비밀번호 재사용 금지 등</p>
              </div>
            </div>

            <div className="bg-orange-50 p-4 border border-orange-200 rounded-md mt-6">
              <strong>⑧ 정보통신서비스 제공자등은 개인정보취급자를 대상으로 다음 각 호의 사항을 포함하는 비밀번호 작성규칙을 수립하고, 이를 적용·운용하여야 한다.</strong>
              <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm font-medium">
                <li><span className="underline decoration-teal-500 decoration-2">영문, 숫자, 특수문자 중 2종류 이상을 조합하여 최소 10자리 이상 또는 3종류 이상을 조합하여 최소 8자리 이상의 길이로 구성</span></li>
                <li><span className="underline decoration-teal-500 decoration-2">연속적인 숫자나 생일, 전화번호 등 추측하기 쉬운 개인정보 및 아이디와 비슷한 비밀번호는 사용하지 않는 것을 권고</span></li>
                <li><span className="underline decoration-teal-500 decoration-2">비밀번호에 유효기간을 설정하여 반기별 1회 이상 변경</span></li>
              </ol>
            </div>

            <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
              <li>정보통신서비스 제공자등은 개인정보취급자가 안전한 비밀번호를 설정하여 이행할 수 있도록 다음의 사항을 포함하는 비밀번호 작성규칙을 수립하고 이를 개인정보처리시스템 등에 적용하여야 한다.
                <p className="mt-2 text-gray-600">- 영대문자, 영소문자, 숫자, 특수문자 중 2종류 이상을 조합하여 최소 10자리 이상 또는 3종류 이상을 조합하여 최소 8자리 이상의 길이로 구성하여야 한다.</p>
                <p className="mt-1 text-gray-600">- 연속적인 문자열이나 숫자, 생년월일, 전화번호 등 추측하기 쉬운 정보 및 아이디와 비슷한 비밀번호는 사용하지 않는 것을 권고한다.</p>
                <p className="mt-1 text-gray-600">- 비밀번호에 유효기간을 설정하여 반기별 1회 이상 변경하여야 한다.</p>
              </li>
            </ul>

          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
