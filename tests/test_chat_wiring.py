"""Chat describes available actions and uses the actual route time schema."""
import unittest
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.routes.chat import _generate_domain_response

class ChatWiringTests(unittest.TestCase):
    def test_route_time_uses_minutes_from_scenario_schema(self):
        reply=_generate_domain_response('blocked routes',{'routes':[{'source':'a','destination':'b','status':'blocked','travel_time_minutes':18,'distance_km':4}]},[])
        self.assertIn('18 minutes',reply.reply)
        self.assertNotIn('None hrs',reply.reply)

    def test_action_suggestion_does_not_claim_or_execute_optimization(self):
        client=TestClient(create_app());before=client.get('/results').json()
        response=client.post('/chat',json={'message':'run allocation'})
        self.assertEqual(response.status_code,200)
        self.assertIn('No optimization has started yet',response.json()['reply'])
        self.assertTrue(any(action['type']=='optimize' for action in response.json()['suggested_actions']))
        self.assertEqual(client.get('/results').json(),before)

if __name__=='__main__':unittest.main()
