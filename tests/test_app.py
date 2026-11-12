import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer

from app import Handler


class AppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None):
        connection = http.client.HTTPConnection(*self.server.server_address)
        connection.request(method, path, body, {"Content-Type": "application/json"})
        response = connection.getresponse()
        status, data = response.status, response.read()
        connection.close()
        return status, data

    def test_assets_and_unknown_paths(self):
        for path in ("/", "/app.js", "/style.css"):
            self.assertEqual(self.request("GET", path)[0], 200)
        self.assertEqual(self.request("GET", "/../lines.py")[0], 404)

    def test_compare_api(self):
        status, body = self.request("POST", "/api/compare", json.dumps({"first": "x=3", "second": "y=1"}))
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["result"]["point"], {"x": 3, "y": 1})

    def test_bad_equation_has_field_error(self):
        status, body = self.request("POST", "/api/compare", json.dumps({"first": "x*x=1", "second": "y=1"}))
        self.assertEqual(status, 400)
        self.assertIn("first", json.loads(body)["errors"])

    def test_invalid_requests(self):
        for body in ("bad json", "[]", "null", "{" * 4000):
            self.assertEqual(self.request("POST", "/api/compare", body)[0], 400)
        self.assertEqual(self.request("POST", "/api/compare", "x" * 4097)[0], 413)


if __name__ == "__main__":
    unittest.main()
