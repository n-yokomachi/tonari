"""tonari_agent.py の retrieval_config テスト"""

from unittest.mock import patch, MagicMock

import pytest

# モジュールをインポートする前に依存をモック
import src.agent.tonari_agent as agent_module


@pytest.fixture(autouse=True)
def mock_externals():
    """外部依存をモック化"""
    with (
        patch.object(agent_module, "BedrockModel", return_value=MagicMock()),
        patch.object(
            agent_module, "AgentCoreMemorySessionManager"
        ) as mock_sm,
        patch.object(agent_module, "Agent", return_value=MagicMock()),
    ):
        yield mock_sm


class TestRetrievalConfig:
    """retrieval_configのクロスセッション対応テスト"""

    def _get_retrieval_config(self, mock_sm):
        agent_module.create_tonari_agent(
            session_id="test-session", actor_id="tonari-owner"
        )
        config = mock_sm.call_args[1]["agentcore_memory_config"]
        return config.retrieval_config

    def test_retrieval_config_has_four_namespace_prefixes(self, mock_externals):
        """retrieval_configに4つのnamespace prefixが定義されていること
        (reflectionsは/episodes/{actorId}/配下に保存されるため独立エントリ不要)"""
        rc = self._get_retrieval_config(mock_externals)
        assert len(rc) == 4

    def test_preferences_namespace_has_trailing_slash(self, mock_externals):
        """preferencesのnamespaceが末尾/で終わること"""
        rc = self._get_retrieval_config(mock_externals)
        pref_keys = [k for k in rc if "/preferences/" in k]
        assert len(pref_keys) == 1
        assert pref_keys[0].endswith("/")

    def test_facts_namespace_has_trailing_slash(self, mock_externals):
        """factsのnamespaceが末尾/で終わること"""
        rc = self._get_retrieval_config(mock_externals)
        fact_keys = [k for k in rc if "/facts/" in k]
        assert len(fact_keys) == 1
        assert fact_keys[0].endswith("/")

    def test_summaries_namespace_is_cross_session(self, mock_externals):
        """summariesのnamespaceがクロスセッション対応（{sessionId}を含まない）であること"""
        rc = self._get_retrieval_config(mock_externals)
        summary_keys = [k for k in rc if "/summaries/" in k]
        assert len(summary_keys) == 1
        assert "{sessionId}" not in summary_keys[0]
        assert summary_keys[0] == "/summaries/{actorId}/"

    def test_episodes_namespace_covers_episodes_and_reflections(
        self, mock_externals
    ):
        """episodesのnamespace prefixがエピソードとリフレクションの両方をカバーすること"""
        rc = self._get_retrieval_config(mock_externals)
        episode_keys = [k for k in rc if "/episodes/" in k]
        assert len(episode_keys) == 1
        assert episode_keys[0] == "/episodes/{actorId}/"

    def test_top_k_and_relevance_score_values(self, mock_externals):
        """各namespaceのtop_kとrelevance_scoreが設計通りであること"""
        rc = self._get_retrieval_config(mock_externals)

        assert rc["/preferences/{actorId}/"].top_k == 5
        assert rc["/preferences/{actorId}/"].relevance_score == 0.5
        assert rc["/facts/{actorId}/"].top_k == 10
        assert rc["/facts/{actorId}/"].relevance_score == 0.4
        assert rc["/summaries/{actorId}/"].top_k == 3
        assert rc["/summaries/{actorId}/"].relevance_score == 0.6
        # episodes top_k=5 (エピソード+リフレクション両方をカバー)
        assert rc["/episodes/{actorId}/"].top_k == 5
        assert rc["/episodes/{actorId}/"].relevance_score == 0.5
